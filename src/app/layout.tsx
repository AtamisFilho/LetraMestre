import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LetraMestre · Console de Operações",
  description:
    "Console de Operações do LetraMestre — Fase 0: Fundação e preparação. Dashboard de ambiente de produção, secrets, build Android, backup SQLite, monitoramento em tempo real, processo de release e dívida técnica.",
  keywords: [
    "LetraMestre",
    "Fase 0",
    "Console de Operações",
    "DevOps",
    "Monitoramento",
    "Scrabble",
    "PT-BR",
  ],
  authors: [{ name: "LetraMestre" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "LetraMestre · Console de Operações",
    description:
      "Dashboard de operações da Fase 0 — fundação e preparação do LetraMestre.",
    siteName: "LetraMestre",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LetraMestre · Console de Operações",
    description:
      "Dashboard de operações da Fase 0 — fundação e preparação do LetraMestre.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
