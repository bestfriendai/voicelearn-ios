import type { Metadata } from "next";
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "UnaMentis Console",
  description: "Unified console for operations monitoring and content management",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <NuqsAdapter>
          <Providers>
            {children}
          </Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
