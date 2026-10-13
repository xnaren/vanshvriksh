import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VanshVriksh — वंशवृक्ष",
  description:
    "A collaborative family tree for Indian families — gotra, family names, and relation-based adding.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-stone-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-bold text-lg text-emerald-800">
              🌳 VanshVriksh <span className="font-normal text-stone-500">वंशवृक्ष</span>
            </a>
            <nav className="flex gap-3 text-sm">
              <a href="/dashboard" className="hover:underline">My trees</a>
              <a href="/login" className="hover:underline">Log in</a>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <footer className="max-w-5xl mx-auto px-4 py-6 text-xs text-stone-500 border-t border-stone-200 mt-12">
          VanshVriksh — baseline MVP. Your family data belongs to your family.
        </footer>
      </body>
    </html>
  );
}
