import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UnaMentis Operations Console",
  description: "Operations console for monitoring system health, resources, and service status",
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
        {children}
      </body>
    </html>
  );
}
