import type { Metadata } from "next";
import { Inter, Quicksand } from "next/font/google";
import { notFound } from "next/navigation";
import { brands, getBrand } from "@/brands";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

// Self-hosted at build time: the visitor's browser never calls Google.
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand", weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export function generateStaticParams() {
  return Object.keys(brands).map((brand) => ({ brand }));
}

export async function generateMetadata({ params }: LayoutProps<"/[brand]">): Promise<Metadata> {
  const brand = getBrand((await params).brand);
  return {
    title: { default: `${brand?.name} – paketresor`, template: `%s · ${brand?.name}` },
    description: brand?.tagline,
    icons:
      brand?.id === "allinc"
        ? {
            icon: [
              { url: "/brands/allinc/favicon.ico", sizes: "any" },
              { url: "/brands/allinc/symbol.svg", type: "image/svg+xml" },
            ],
            apple: "/brands/allinc/apple-touch-icon.png",
          }
        : undefined,
  };
}

export default async function BrandLayout({ children, params }: LayoutProps<"/[brand]">) {
  const brand = getBrand((await params).brand);
  if (!brand) notFound();
  return (
    <html lang="sv" data-brand={brand.id} className={`${quicksand.variable} ${inter.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader brand={brand} />
        <div className="flex-1">{children}</div>
        <SiteFooter brand={brand} />
      </body>
    </html>
  );
}
