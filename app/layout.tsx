import type { Metadata } from "next";
import { DM_Serif_Display, Sora } from "next/font/google";
import "./globals.css";

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
  title: "BrainDump — Cognitive Load Manager",
  description:
    "Type, speak, or drop files. BrainDump turns the chaos in your head into a clear action plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSerifDisplay.variable} ${sora.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
