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
          <div className="px-4 py-2 flex items-center gap-3">
            <a href="/" className="font-bold text-lg text-emerald-800 shrink-0">
              🌳 VanshVriksh <span className="font-normal text-stone-500">वंशवृक्ष</span>
            </a>
            {/* Tree pages portal their name + controls into this slot
                (see TreeToolbar's HeaderPortal). Empty elsewhere. */}
            <div
              id="vv-header-slot"
              className="flex-1 min-w-0 flex items-center justify-center"
            />
            <nav className="flex items-center gap-3 text-sm shrink-0">
              <a href="/about" className="hover:underline hidden sm:inline">About</a>
              <a href="/dashboard" className="hover:underline hidden sm:inline">My trees</a>
              <a href="/login" className="hover:underline">Log in</a>
              <a
                href="/signup"
                className="bg-emerald-700 text-white rounded-md px-3 py-1.5 font-medium hover:bg-emerald-800"
              >
                Start tree
              </a>
            </nav>
          </div>
        </header>
        {/* Full-width main: pages set their own measure — reading pages
            use a centered max-w-5xl column; the tree page goes
            full-bleed so the canvas uses the whole window width. */}
        <main className="w-full">{children}</main>
        <footer className="max-w-5xl mx-auto px-4 py-6 text-xs text-stone-500 border-t border-stone-200 mt-12">
          VanshVriksh — connecting families across time and space, preserving
          generations and legacies. Your family data belongs to your family.{" "}
          <a href="/about" className="underline">About</a>
        </footer>
      </body>
    </html>
  );
}
