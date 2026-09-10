import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CashFacttory · cTrader Strategy Lab",
  description: "Quatro estratégias rápidas para cTrader, com paper trading e travas para demo e real"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
