import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Mountains_of_Christmas } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "TGM Check-in | Visitor management",
  description: "A simpler way to welcome and check in office visitors.",
};

const festiveFont = Mountains_of_Christmas({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-festive" });

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={festiveFont.variable}>
      <body>{children}</body>
    </html>
  );
}
