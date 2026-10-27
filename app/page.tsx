// Landing page: hero over a faint example tree, the mission in the
// user's own words (polished, not rewritten), the four things you can
// do, what makes it Indian, and a legible showcase of the same
// example tree. The hero background is the Nehru family — an
// illustrative example only, never a user's own tree.
import Link from "next/link";
import ExampleTree from "@/components/ExampleTree";

const FEATURES = [
  {
    title: "🌳 Build your VanshVriksh",
    text: "Easily create a tree and add family connections — the way families actually think: father, mother, husband, wife, son, daughter, brother, sister.",
  },
  {
    title: "📊 Visualize your VanshVriksh",
    text: "Explore your family history through pedigree, circular, ancestor-chart, fan, hourglass, timeline and map views — not just one diagram.",
  },
  {
    title: "🔍 Find lost connections",
    text: "Search, find and reconnect with forgotten people — across branches, generations and geographies.",
  },
  {
    title: "🖼️ Preserve memories",
    text: "Add photos, memories and stories to the people in your tree, so the past stays a living story instead of a fading name.",
  },
];

const INDIAN_FIELDS = [
  {
    title: "🪔 Indianized fields",
    text: "Gotra, family name and native place (मूल गाँव) on every person — the details Western genealogy tools skip.",
  },
  {
    title: "🤝 Truly collaborative",
    text: "Invite relatives with a link. Everyone builds the same tree together, with viewer / editor / owner roles.",
  },
  {
    title: "🔐 Passwordless login",
    text: "No passwords to forget or leak. Log in with your username, solve a quick bot-check, and enter the one-time code sent to your email.",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero — the example tree sits behind the words, softened by a
          gradient so the text stays readable. */}
      <section className="relative overflow-hidden bg-emerald-50/60">
        <div className="absolute inset-0" aria-hidden="true">
          <ExampleTree className="w-full h-full opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/70 to-stone-50" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-20 text-center">
          <div className="text-6xl mb-4">🌳</div>
          <p className="text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-2">
            Welcome to VanshVriksh
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-emerald-900 mb-3">
            VanshVriksh <span className="font-normal">वंशवृक्ष</span>
          </h1>
          <p className="text-xl text-stone-700 mb-6">
            Connecting families across time and space — preserving
            generations and legacies.
          </p>
          <p className="text-stone-600 max-w-2xl mx-auto mb-4 leading-relaxed">
            Welcome to VanshVriksh, where family history comes alive. Our
            mission is to help you discover, explore and cherish your
            unique lineage. We embrace the philosophy of{" "}
            <em lang="te">జగమంతా కుటుంబం నాది</em>{" "}
            <span className="text-stone-500">
              (“jagamanta kutumbham naadi” — the world is one family)
            </span>{" "}
            — believing we are all interconnected.
          </p>
          <p className="text-stone-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            With powerful tools to visualize family trees, uncover forgotten
            connections and preserve precious memories, we help bridge the
            gaps between generations and geographies. Whether you are
            tracing your roots or reconnecting with forgotten relatives,
            VanshVriksh is your companion — weaving the past into vibrant,
            living stories. With VanshVriksh, every connection strengthens
            the bonds of family.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="btn-primary px-6 py-3 text-lg">
              Start your tree
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-lg">
              Log in
            </Link>
            <Link href="/about" className="btn-secondary px-6 py-3 text-lg">
              Our story
            </Link>
          </div>
        </div>
      </section>

      {/* What you can do */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">
          Family stories and memories come alive here
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What makes it Indian + how sign-in works */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-3 gap-4">
          {INDIAN_FIELDS.map((f) => (
            <div key={f.title} className="card">
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example tree, at full strength */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="card overflow-hidden">
          <h2 className="text-xl font-bold mb-1">
            What a tree looks like — an example
          </h2>
          <p className="text-sm text-stone-600 mb-4">
            The Nehru family, four generations from Motilal Nehru down to
            Rajiv and Sanjay Gandhi. This is an illustration of the shape
            of a tree — your tree will hold your own family.
          </p>
          <div className="overflow-x-auto">
            <ExampleTree className="w-full min-w-[640px] h-auto" />
          </div>
        </div>
      </section>
    </div>
  );
}
