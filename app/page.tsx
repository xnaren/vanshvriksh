// Landing page — compact split layout (redesigned Oct 28, 2026 from
// Narendra's screenshot feedback on the first version):
//   - No faint background tree behind the text, and no hero buttons
//     duplicating the header's Log in / Start tree. The header owns
//     those actions; the hero owns the words.
//   - Left: welcome, tagline, a short mission, the philosophy line.
//   - Right: the Nehru example tree at full strength in its own
//     panel — an illustration, never a user's own tree.
//   - Below: the four features in one row, and the Indian
//     differentiators folded into a single line instead of a second
//     card section. The page ends there — no separate showcase.
import Link from "next/link";
import ExampleTree from "@/components/ExampleTree";

const FEATURES = [
  {
    title: "🌳 Build",
    text: "Create a tree and add connections the way families think: father, mother, husband, wife, son, daughter, brother, sister.",
  },
  {
    title: "📊 Visualize",
    text: "Pedigree, circular, ancestor-chart, fan, hourglass, timeline and map views — not just one diagram.",
  },
  {
    title: "🔍 Find lost connections",
    text: "Search, find and reconnect with forgotten people across branches, generations and geographies.",
  },
  {
    title: "🖼️ Preserve memories",
    text: "Photos, memories and stories on the people in your tree, so the past stays a living story.",
  },
];

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
      <div className="grid lg:grid-cols-5 gap-8 items-center">
        {/* Content half */}
        <div className="lg:col-span-2">
          <p className="text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-2">
            🌳 Welcome to VanshVriksh
          </p>
          <h1 className="text-4xl font-bold text-emerald-900 mb-3">
            VanshVriksh <span className="font-normal">वंशवृक्ष</span>
          </h1>
          <p className="text-xl text-stone-700 mb-4">
            Connecting families across time and space — preserving
            generations and legacies.
          </p>
          <p className="text-stone-600 leading-relaxed mb-4">
            Welcome to VanshVriksh, where family history comes alive. Our
            mission is to help you discover, explore and cherish your
            unique lineage — and bridge the gaps between generations and
            geographies.
          </p>
          <p className="text-stone-600 leading-relaxed mb-4">
            We embrace the philosophy of{" "}
            <em lang="te">జగమంతా కుటుంబం నాది</em>{" "}
            <span className="text-stone-500">
              (“jagamanta kutumbham naadi” — the world is one family)
            </span>
            , believing we are all interconnected.
          </p>
          <Link href="/about" className="text-emerald-700 underline text-sm">
            Our story →
          </Link>
        </div>

        {/* Example tree half — full strength, not a faint background */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            <p className="text-sm font-semibold mb-1">
              What a tree looks like — an example
            </p>
            <p className="text-xs text-stone-500 mb-3">
              The Nehru family, four generations from Motilal Nehru down to
              Rajiv and Sanjay Gandhi. An illustration of the shape of a
              tree — your tree will hold your own family.
            </p>
            <div className="overflow-x-auto">
              <ExampleTree className="w-full min-w-[560px] h-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Features — consolidated into one row */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold text-center mb-6">
          Family stories and memories come alive here
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
