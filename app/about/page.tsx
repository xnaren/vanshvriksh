// About page: the mission, the philosophy, what you can do, and how
// it works — the landing copy in full, not just the hero version.
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-emerald-800 uppercase mb-2">
          About
        </p>
        <h1 className="text-4xl font-bold text-emerald-900 mb-3">
          VanshVriksh <span className="font-normal">वंशवृक्ष</span>
        </h1>
        <p className="text-xl text-stone-700 mb-8">
          Connecting families across time and space — preserving generations
          and legacies.
        </p>
      </div>

      <section className="card max-w-2xl mb-8">
        <h2 className="font-semibold text-lg mb-2">Our mission</h2>
        <p className="text-stone-600 leading-relaxed mb-3">
          Welcome to VanshVriksh, where family history comes alive. Our
          mission is to help you discover, explore and cherish your unique
          lineage. We offer powerful tools to visualize family trees,
          uncover forgotten connections and preserve precious memories —
          to help bridge the gaps between generations and geographies.
        </p>
        <p className="text-stone-600 leading-relaxed">
          VanshVriksh is your companion in this discovery, whether you are
          tracing your roots or reconnecting with forgotten relatives. We
          help to weave the past into vibrant, living stories and memories.
          With VanshVriksh, every connection strengthens the bonds of
          family. Family stories and memories come alive here.
        </p>
      </section>

      <section className="card max-w-2xl mb-8 bg-emerald-50 border-emerald-200">
        <h2 className="font-semibold text-lg mb-2">A philosophy we live by</h2>
        <p lang="te" className="text-2xl font-semibold text-emerald-900 mb-2">
          జగమంతా కుటుంబం నాది
        </p>
        <p className="text-stone-700 leading-relaxed">
          <em>“Jagamanta kutumbham naadi”</em> — the world is one family.
          We believe we are all interconnected, and that a family tree is
          not just a record of who came before us, but a reminder of how
          much we share.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-3">What you can do</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-1">🌳 Build your VanshVriksh</h3>
            <p className="text-sm text-stone-600">
              Easily create a tree and add family connections, the way
              families actually think: father, mother, husband, wife, son,
              daughter, brother, sister.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-1">📊 Visualize your VanshVriksh</h3>
            <p className="text-sm text-stone-600">
              Explore your family history through pedigree, circular,
              ancestor-chart, fan, hourglass, timeline and map views.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-1">🔍 Find lost connections</h3>
            <p className="text-sm text-stone-600">
              Search, find and reconnect with forgotten people — across
              branches, generations and geographies.
            </p>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-1">🖼️ Preserve memories</h3>
            <p className="text-sm text-stone-600">
              Add photos, memories and stories to the people in your tree,
              so the past stays a living story instead of a fading name.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-3">How it works</h2>
        <ol className="space-y-3 max-w-2xl">
          <li className="card">
            <strong>1. Create a tree.</strong>{" "}
            <span className="text-stone-600">
              Name your family tree. You become its owner.
            </span>
          </li>
          <li className="card">
            <strong>2. Add people by relation.</strong>{" "}
            <span className="text-stone-600">
              Start with yourself, then add relatives by their relation to
              you. Gotra, family name and native place travel with each
              person.
            </span>
          </li>
          <li className="card">
            <strong>3. Invite your family.</strong>{" "}
            <span className="text-stone-600">
              Share an invite link. Relatives join as viewers or editors and
              build the same tree with you.
            </span>
          </li>
          <li className="card">
            <strong>4. Choose how it is shared.</strong>{" "}
            <span className="text-stone-600">
              A tree can stay private, be shared by invite, or be made
              public — and individual members can be kept private even
              inside a public tree.
            </span>
          </li>
        </ol>
      </section>

      <section className="card max-w-2xl mb-8">
        <h2 className="font-semibold text-lg mb-2">Your family, your data</h2>
        <p className="text-sm text-stone-600">
          Your family data belongs to your family. Sign-in is passwordless
          (username, a quick bot-check, and a one-time code by email), so
          there is no password to forget or leak.
        </p>
      </section>

      <div className="flex gap-3 flex-wrap">
        <Link href="/signup" className="btn-primary px-6 py-3 text-lg">
          Start your tree
        </Link>
        <Link href="/login" className="btn-secondary px-6 py-3 text-lg">
          Log in
        </Link>
      </div>
    </div>
  );
}
