import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/presentation/components/providers";

export const metadata: Metadata = {
  title: "Dominó Online",
  description: "Plataforma para jugar dominó por parejas en tiempo real",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
