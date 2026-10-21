// Landing page.
import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-6xl mb-4">🌳</div>
        <h1 className="text-4xl font-bold text-emerald-900 mb-2">
          VanshVriksh <span className="font-normal">वंशवृक्ष</span>
        </h1>
        <p className="text-lg text-stone-600 mb-8">
          A collaborative family tree built for Indian families — with gotra,
          family names, and native place, not just first and last names.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/signup" className="btn-primary px-6 py-3 text-lg">
            Start your tree
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-lg">
            Log in
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-16">
        <div className="card">
          <h3 className="font-semibold mb-1">🪔 Indianized fields</h3>
          <p className="text-sm text-stone-600">
            Gotra, family name, native place (मूल गाँव) on every person —
            the details Western genealogy tools skip.
          </p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">👨‍👩‍👧 Relation-based adding</h3>
          <p className="text-sm text-stone-600">
            Add members the way families think: “father”, “wife”, “daughter” —
            the tree wires itself up automatically.
          </p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">🤝 Truly collaborative</h3>
          <p className="text-sm text-stone-600">
            Invite relatives with a link. Everyone builds the same tree
            together, with viewer / editor / owner roles.
          </p>
        </div>
      </div>

      <div className="card mt-8 bg-emerald-50 border-emerald-200">
        <h3 className="font-semibold mb-1">🔐 Passwordless login</h3>
        <p className="text-sm text-stone-600">
          No passwords to forget or leak. Log in with your username, solve a
          quick bot-check, and enter the one-time code sent to your email.
        </p>
      </div>
    </div>
  );
}
