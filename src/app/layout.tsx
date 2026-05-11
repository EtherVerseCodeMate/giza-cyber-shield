import type { Metadata } from "next";
import "../index.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "AdinKhepra ASAF";
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

export const metadata: Metadata = {
  title: `${appName} — Agentic Security Attestation Framework`,
  description: "Scan, audit, and certify your AI agent deployments. Get your ADINKHEPRA badge — the enterprise security standard for agentic AI.",
  other: {
    "x-app-version": appVersion,
  },
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
