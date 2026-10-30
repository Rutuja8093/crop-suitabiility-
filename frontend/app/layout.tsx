import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { AppShell } from "@/components/layout/AppShell";
import { Footer } from "@/components/layout/Footer";
import { DemoBanner } from "@/components/common/DemoBanner";

export const metadata: Metadata = {
  title: "SoilPilot — Digital Soil Mapping & Soil Health Portal",
  description: "Farmer-friendly digital soil mapping, cadastral Gat-based field access, soil health cards, and crop recommendations.",
  keywords: ["Soil Health", "Digital Soil Mapping", "Farmer Portal", "Agriculture", "Soil Test", "Gat Number"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-surface-subtle font-sans">
        <Providers>
          <Header />
          <AppShell>{children}</AppShell>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
