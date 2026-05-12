import type { Metadata } from "next";
import { Sora, Outfit } from "next/font/google";

import "./globals.css";

const display = Sora({
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const body = Outfit({
  variable: "--font-reading",
  subsets: ["latin"],
});

import { Toaster } from "@/components/app/toaster";

export const metadata: Metadata = {
  title: "Kiromilog",
  description: "Listas de anime e manga em um lugar simples.",
};

export default function RootLayort({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-US"
      className={`${display.variable} ${body.variable} antialiased`}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
