import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "@/server/trpc/react";

// Load the Inter font
const inter = Inter({ subsets: ["latin"] });

// Metadata for SEO and browser
export const metadata: Metadata = {
  title: "Tuno - Notetaking and Todo App",
  description:
    "Tuno is a next-gen note taking and todo list app designed for the busy mind in an even busier world",
};

// Root layout: server component by default
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* TRPCReactProvider is a client component */}
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
