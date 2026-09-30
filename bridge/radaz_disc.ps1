param([ValidateSet('List','Iso','Burn')][string]$Mode = 'List', [string]$Source, [string]$Destination, [string]$RecorderId)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
    $master = New-Object -ComObject IMAPI2.MsftDiscMaster2
    if ($Mode -eq 'List') {
        $drives = @()
        foreach ($deviceId in $master) {
            $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
            $recorder.InitializeDiscRecorder($deviceId)
            $writer = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
            $supported = [bool]$writer.IsRecorderSupported($recorder)
            $mediaSupported = $false; $blank = $false; $freeBytes = 0
            if ($supported) {
                $writer.Recorder = $recorder
                $mediaSupported = [bool]$writer.IsCurrentMediaSupported($recorder)
                if ($mediaSupported) { $blank = [bool]$writer.MediaHeuristicallyBlank; $freeBytes = [long]$writer.FreeSectorsOnMedia * 2048 }
            }
            $drives += @{ id=[string]$deviceId; name=([string]$recorder.VendorId+' '+[string]$recorder.ProductId).Trim(); volumes=@($recorder.VolumePathNames); canWrite=$supported; mediaSupported=$mediaSupported; blank=$blank; freeBytes=$freeBytes }
        }
        $printers = @(Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
        @{ drives=$drives; printers=$printers } | ConvertTo-Json -Depth 5 -Compress
        exit 0
    }
    $sourcePath = (Resolve-Path -LiteralPath $Source).Path
    if (!(Test-Path -LiteralPath (Join-Path $sourcePath 'DICOMDIR'))) { throw 'DICOMDIR tapılmadı' }
    $image = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
    $image.VolumeName = 'RADAZ_DICOM'
    $image.FileSystemsToCreate = 3 # ISO 9660 and Joliet
    if ($Mode -eq 'Burn') {
        $recorder = New-Object -ComObject IMAPI2.MsftDiscRecorder2
        $recorder.InitializeDiscRecorder($RecorderId)
        $writer = New-Object -ComObject IMAPI2.MsftDiscFormat2Data
        if (!$writer.IsRecorderSupported($recorder)) { throw 'Bu qurğu yalnız oxuyur. CD/DVD writer qoşun.' }
        $writer.Recorder = $recorder
        $writer.ClientName = 'RADAZ'
        if (!$writer.IsCurrentMediaSupported($recorder) -or !$writer.MediaHeuristicallyBlank) { throw 'Uyğun boş CD/DVD daxil edin. Mövcud disk silinmir.' }
        $image.ChooseImageDefaults($recorder)
        $image.FileSystemsToCreate = 3
        $image.FreeMediaBlocks = $writer.FreeSectorsOnMedia
    } else {
        $total = (Get-ChildItem -LiteralPath $sourcePath -File -Recurse | Measure-Object -Property Length -Sum).Sum
        $image.ChooseImageDefaultsForMediaType($(if ($total -lt 680MB) { 2 } else { 6 }))
        $image.FileSystemsToCreate = 3
    }
    $image.Root.AddTree($sourcePath, $false)
    $result = $image.CreateResultImage()
    if ($Mode -eq 'Burn') {
        $writer.ForceMediaToBeClosed = $true
        $writer.Write($result.ImageStream)
        @{message='CD/DVD-yə yazma tamamlandı. Disk digər cihazlarda oxunmaq üçün bağlandı.'} | ConvertTo-Json -Compress
    } else {
        Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class RadazIsoStream {
    public static void Save(object source, string destination) {
        IStream stream = (IStream)source;
        IntPtr read = Marshal.AllocHGlobal(4);
        try {
            byte[] buffer = new byte[1048576];
            using (FileStream output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None)) {
                while (true) {
                    stream.Read(buffer, buffer.Length, read);
                    int count = Marshal.ReadInt32(read);
                    if (count == 0) break;
                    output.Write(buffer, 0, count);
                }
                output.Flush(true);
            }
        } finally { Marshal.FreeHGlobal(read); }
    }
}
'@
        [RadazIsoStream]::Save($result.ImageStream, $Destination)
        @{message='CD/DVD ISO faylı hazırdır.'} | ConvertTo-Json -Compress
    }
} catch {
    [Console]::WriteLine($_.Exception.Message)
    exit 1
}
