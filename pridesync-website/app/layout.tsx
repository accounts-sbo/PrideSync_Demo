import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrideSync - Pride Parade Coordination System",
  description: "Real-time coordination system for Pride parades in the Netherlands",
  keywords: ["pride", "parade", "coordination", "amsterdam", "netherlands"],
  authors: [{ name: "PrideSync Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
