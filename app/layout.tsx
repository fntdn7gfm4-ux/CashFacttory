import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CashFacttory · Deriv Strategy Lab",
  description: "Quatro estratégias rápidas para Deriv, com paper trading e integração segura para demo e real"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
