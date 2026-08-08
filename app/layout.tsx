import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YOUNHEEPARK Corp. STOCK",
  description: "의류 브랜드를 위한 내부 재고관리",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
