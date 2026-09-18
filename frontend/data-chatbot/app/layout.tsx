import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import ConfigureAmplify from "./components/ConfigureAmplify";
import AuthProvider from "./components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FGAC Data Agent",
  description: "Team-aware chatbot for the FGAC Data Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConfigureAmplify />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
