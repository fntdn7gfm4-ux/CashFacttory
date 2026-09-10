import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CashFacttory · Paper Trading Lab",
  description: "Painel seguro de automação e simulação multi-plataforma"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
