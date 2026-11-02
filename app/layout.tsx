import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "LendLoop",
  description: "Borrow tools from your neighbors for a few days, then hand them back.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${sans.variable} ${mono.variable}`}>
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
