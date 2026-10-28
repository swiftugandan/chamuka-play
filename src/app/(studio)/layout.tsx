import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { fredoka, nunito } from "../fonts";
import "../globals.css";

// The studio is the Chamuka Play app. Each game's own app (/play/…) has a
// separate root layout so it never picks up this app's manifest or icons.
export const metadata: Metadata = {
  title: "Chamuka Play",
  description: "Make your own games and learn by making.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Chamuka" },
  icons: { apple: "/apple-icon-180.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#7a3cf0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
