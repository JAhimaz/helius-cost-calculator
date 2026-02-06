import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helius Plan Calculator",
  description: "Calculate your Helius API costs based on usage and plan selection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
