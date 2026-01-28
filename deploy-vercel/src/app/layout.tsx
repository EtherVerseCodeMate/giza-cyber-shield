import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "KHEPRA Protocol - Master Operator Console",
  description: "Sovereign Security Operations Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
