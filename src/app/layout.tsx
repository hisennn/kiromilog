import type { Metadata } from "next";
import { Sora } from "next/font/google";
import localFont from "next/font/local";

import "./globals.css";

const display = Sora({
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const body = localFont({
  variable: "--font-reading",
  src: [
    {
      path: "../../public/fonts/switzer/Switzer-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/switzer/Switzer-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/switzer/Switzer-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/switzer/Switzer-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/switzer/Switzer-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
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
