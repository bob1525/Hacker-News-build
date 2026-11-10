import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hacker News",
    template: "%s | Hacker News",
  },
  description: "A compact Hacker News-style community for stories, discussion, and karma.",
};

export const viewport: Viewport = {
  themeColor: "#ff6600",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-hn-bg font-sans text-black antialiased">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <div id="content" className="mx-auto w-full max-w-[980px] flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
