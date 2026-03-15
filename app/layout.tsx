import type { Metadata } from "next";
import { DM_Serif_Display, Sora, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearHead — Cognitive Load Manager",
  description:
    "Dump everything on your mind. AI organises it into a clear action plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body
        className={`${dmSerifDisplay.variable} ${sora.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
