import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCProvider } from "@/server/trpc/react"; // Import the tRPC client provider

const inter = Inter({ subsets: ["latin"] });

// Metadata for your Next.js application (e.g., page title, description)
export const metadata: Metadata = {
  title: "Dunno App",
  description: "A Next.js application with tRPC integration.",
};

// The RootLayout component wraps your entire application.
// It's where you'll include global elements like navigation, footers, and providers.
export default function RootLayout({
  children, // 'children' represents the content of the current page or nested layout
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* TRPCProvider makes your tRPC client available to all components */}
        {/* This is crucial for making API calls from your React components */}
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
