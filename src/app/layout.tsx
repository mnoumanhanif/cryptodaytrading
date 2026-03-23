import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoScanner – Day Trading Dashboard",
  description:
    "Auto-scan top 100 USDT pairs, identify 10-25% gain potential, and get buy/sell/hold signals with target prices and stop losses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-white">
        {children}
      </body>
    </html>
  );
}
