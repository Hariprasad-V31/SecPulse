import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SecPulse — AI-Powered Security Maturity Tracker",
  description:
    "Upload security questionnaires, track maturity scores per team, and surface logical anomalies with GitHub Models.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="app-backdrop min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
