import type { Metadata, Viewport } from "next";
// Inter, self-hosted through npm: no dependency on Google Fonts being reachable at build or dev time.
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "OnlyBudget",
  description: "Suivi des ventes, dépenses et trésorerie de l'agence",
  applicationName: "OnlyBudget",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "OnlyBudget", statusBarStyle: "black-translucent" },
};

// An app, not a document: no pinch-zoom, and no double-tap zoom swallowing quick taps.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
