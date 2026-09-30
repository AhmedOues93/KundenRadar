import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} – Akquise-Radar für Webagenturen`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Interne Anwendung zum Finden, Analysieren und Qualifizieren potenzieller Neukunden für Webagenturen.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
