"""Generate small, synthetic, valid DICOM Part 10 CT stacks for local viewer QA."""
from pathlib import Path
import math
import struct
import zlib
import numpy as np

OUT = Path(__file__).resolve().parents[1] / "public" / "demo"
OUT.mkdir(parents=True, exist_ok=True)
N = 256
y, x = np.mgrid[-1:1:complex(N), -1:1:complex(N)]


def ellipse(cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1


def anatomy(kind, slice_num):
    rng = np.random.default_rng(20260926 + slice_num + (0 if kind == "thorax" else 100))
    im = np.full((N, N), -1000., dtype=float)
    body = ellipse(0, 0, .87, .84)
    im[body] = 32 + 6 * rng.normal(size=body.sum())
    im[ellipse(0, 0, .77, .75)] = 51
    if kind == "thorax":
        for cx in (-.41, .41):
            lung = ellipse(cx, -.11, .32, .51)
            im[lung] = -820 + 18 * rng.normal(size=lung.sum())
            for k in range(15):
                vx = cx + (.13 * math.sin(k * 2.3 + slice_num * .2))
                vy = -.36 + k * .045
                vessel = ellipse(vx, vy, .009 + .004 * (k % 3), .014)
                im[vessel & lung] = 40
        im[ellipse(.03, -.05, .22, .28)] = 67
        im[ellipse(.06, -.45, .054, .06)] = -950
        for angle in np.linspace(0, 2*math.pi, 16, endpoint=False):
            cx, cy = .81 * math.cos(angle), .77 * math.sin(angle)
            im[ellipse(cx, cy, .032, .04) & body] = 370
    else:
        im[ellipse(0, -.10, .50, .40)] = 56
        im[ellipse(-.35, -.24, .28, .30)] = 80
        im[ellipse(.44, -.24, .23, .27)] = 71
        for cx in (-.52, .51):
            im[ellipse(cx, .25, .18, .24)] = 105
            im[ellipse(cx + (.055 if cx < 0 else -.055), .25, .06, .12)] = 31
        im[ellipse(.09, -.36, .20, .12)] = 145
        im[ellipse(0, -.36, .07, .065)] = 53
        for cx, cy in [(-.25,.09),(.22,.12),(-.17,.44),(.24,.47)]:
            im[ellipse(cx, cy, .10, .075)] = -120
    im[ellipse(0, .60, .14, .15)] = 330
    im[ellipse(0, .60, .073, .071)] = 48
    im[ellipse(0, .60, .036, .035)] = 215
    # Very small changes across positions show that scrolling loads distinct instances.
    im += (slice_num - 2) * 2 * body
    return np.clip(np.round(im + 1024), 0, 4095).astype('<u2')


LONG_VR = {'OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'OD', 'OL', 'UC', 'UR'}


def element(group, number, vr, value):
    if isinstance(value, str):
        value = value.encode('ascii')
        value += b'\0' if vr == 'UI' and len(value) % 2 else b' ' if len(value) % 2 else b''
    elif isinstance(value, int):
        value = struct.pack('<H' if vr == 'US' else '<I', value)
    assert len(value) % 2 == 0
    tag = struct.pack('<HH', group, number) + vr.encode()
    if vr in LONG_VR:
        return tag + b'\0\0' + struct.pack('<I', len(value)) + value
    return tag + struct.pack('<H', len(value)) + value


def write_dicom(kind, number):
    root = '1.2.826.0.1.3680043.10.54321'
    study = root + '.20260926.1'
    series = root + ('.1.1' if kind == 'thorax' else '.1.2')
    sop = series + '.' + str(number)
    pixel = anatomy(kind, number).tobytes()
    meta = b''.join([
        element(0x0002, 0x0001, 'OB', b'\x00\x01'),
        element(0x0002, 0x0002, 'UI', '1.2.840.10008.5.1.4.1.1.2'),
        element(0x0002, 0x0003, 'UI', sop),
        element(0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1'),
        element(0x0002, 0x0012, 'UI', root + '.1'),
    ])
    vals = [
        (0x0008,0x0016,'UI','1.2.840.10008.5.1.4.1.1.2'),
        (0x0008,0x0018,'UI',sop),
        (0x0008,0x0020,'DA','20260926'),
        (0x0008,0x0030,'TM','120000'),
        (0x0008,0x0060,'CS','CT'),
        (0x0008,0x1030,'LO','Demo CT study'),
        (0x0008,0x103E,'LO','CT Thorax AX' if kind == 'thorax' else 'CT Abdomen AX'),
        (0x0010,0x0010,'PN','DEMO^PASIENT'),
        (0x0010,0x0020,'LO','DEMO-001'),
        (0x0010,0x0030,'DA','19800101'),
        (0x0018,0x0050,'DS','3'),
        (0x0020,0x000D,'UI',study),
        (0x0020,0x000E,'UI',series),
        (0x0020,0x0011,'IS','1' if kind == 'thorax' else '2'),
        (0x0020,0x0013,'IS',str(number)),
        (0x0020,0x0032,'DS',f'0\\0\\{number*3}'),
        (0x0020,0x0037,'DS','1\\0\\0\\0\\1\\0'),
        (0x0028,0x0002,'US',1),
        (0x0028,0x0004,'CS','MONOCHROME2'),
        (0x0028,0x0010,'US',N),
        (0x0028,0x0011,'US',N),
        (0x0028,0x0030,'DS','0.8\\0.8'),
        (0x0028,0x0100,'US',16),
        (0x0028,0x0101,'US',16),
        (0x0028,0x0102,'US',15),
        (0x0028,0x0103,'US',0),
        (0x0028,0x1050,'DS','50'),
        (0x0028,0x1051,'DS','400'),
        (0x0028,0x1052,'DS','-1024'),
        (0x0028,0x1053,'DS','1'),
        (0x7FE0,0x0010,'OW',pixel),
    ]
    body = b''.join(element(*v) for v in vals)
    output = b'\0' * 128 + b'DICM' + element(0x0002, 0x0000, 'UL', len(meta)) + meta + body
    (OUT / f'{kind}-{number}.dcm').write_bytes(output)


def thumb(kind):
    im = anatomy(kind, 3).astype(float) - 1024
    ww, wl = (1500, -550) if kind == 'thorax' else (400, 50)
    gray = np.clip((im - (wl - ww / 2)) / ww * 255, 0, 255).astype('uint8')
    raw = b''.join(b'\0' + row.tobytes() for row in gray)
    def chunk(code, data):
        return struct.pack('>I', len(data)) + code + data + struct.pack('>I', zlib.crc32(code + data))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', N,N,8,0,0,0,0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    (OUT / f'{kind}.png').write_bytes(png)


for kind in ('thorax', 'abdomen'):
    for number in range(1, 6):
        write_dicom(kind, number)
    thumb(kind)
print('Generated 10 synthetic DICOM files and two thumbnails')
