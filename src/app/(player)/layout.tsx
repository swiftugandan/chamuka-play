import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { fredoka, nunito } from "../fonts";
import "../globals.css";

// Root layout for a single game running as its own app (/play/<id>). Its name,
// icon and web app manifest are set in the browser by <GamePlayer>, from the
// game itself — so nothing here may link the Chamuka Play manifest.
// No title here: <GamePlayer> renders the game's own (a second <title> from
// metadata would win, as browsers use the first).
export const metadata: Metadata = {
  description: "A game made with Chamuka Play.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1b1036",
  viewportFit: "cover",
};

export default function PlayerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden bg-[#1b1036]">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
