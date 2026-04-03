import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WZBC Media Database",
  description: "WZBC Boston College radio station media catalog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative min-h-screen bg-bc-maroon">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
