import type { Metadata, Viewport } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "Code Tracker",
  appleWebApp: { capable: true, title: "Tracker" },
};
export const viewport: Viewport = { themeColor: "#0a0a0a" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
