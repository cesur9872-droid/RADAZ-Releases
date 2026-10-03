import type { Metadata } from "next";
import "./globals.css";
import { ProductBoundary } from '@/components/app-product';
import { ViewerFullscreen } from '@/components/viewer-fullscreen';

export const metadata: Metadata = {
  title: "RADAZ | DICOM Viewer",
  description: "RADAZ — radioloq Rövşən Nağıyev tərəfindən hazırlanmış şəxsi DICOM görüntüləyici.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az">
      <body className="antialiased"><ViewerFullscreen/><ProductBoundary>{children}</ProductBoundary></body>
    </html>
  );
}
