import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KQL Hunter",
  description: "Daily KQL hunt practice for SOC and threat hunting beginners"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
