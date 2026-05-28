import type { Metadata } from "next";
import { Merriweather, Source_Sans_3 } from "next/font/google";

import "../styles/globals.css";

const display = Merriweather({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "ProjectFlow",
  description: "Active project agent workspace for college teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
