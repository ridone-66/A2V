import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: {
    default: "A2V — Acheter, vendre et enchérir en confiance",
    template: "%s | A2V",
  },
  description:
    "A2V est la marketplace communautaire française : annonces gratuites, enchères en temps réel, trophées, offres Premium et engagement solidaire. Commission de 0,5 % sur les ventes finalisées.",
  keywords: ["marketplace", "enchères", "achat", "revente", "seconde main", "A2V", "trophées", "Premium"],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: APP_NAME,
    title: "A2V — Acheter, vendre et enchérir en confiance",
    description:
      "Annonces gratuites, enchères vérifiées, trophées et offres Premium. Une marketplace française engagée.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#6D28D9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white font-sans antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Aller au contenu principal
        </a>
        <SiteHeader />
        <main id="contenu" className="min-h-[60vh]">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
