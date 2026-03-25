import Link from "next/link";

const pages = [
  {
    href: "/tracker",
    emoji: "🎲",
    title: "Tracker",
    description:
      "Count songs as they play and see real-time odds of hitting a line, double, or blackout.",
  },
  {
    href: "/boards",
    emoji: "📋",
    title: "Boards",
    description:
      "Enter everyone's bingo cards, call songs as they play, and instantly see who has a bingo.",
  },
  {
    href: "/songs",
    emoji: "🎵",
    title: "Songs",
    description:
      "Load a public Spotify playlist to see every song in the game at a glance.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-sm flex flex-col gap-10">

        {/* Hero */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-4xl font-black tracking-tight text-white uppercase">
            Mingo Bingo
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your toolkit for music bingo — track the game, manage cards, and browse the playlist all in one place.
          </p>
        </div>

        {/* Page cards */}
        <div className="flex flex-col gap-3">
          {pages.map(({ href, emoji, title, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 active:border-zinc-500 rounded-2xl p-5 transition-colors"
            >
              <span className="text-3xl leading-none mt-0.5">{emoji}</span>
              <div className="flex flex-col gap-1">
                <span className="text-white font-bold text-base">{title}</span>
                <span className="text-zinc-500 text-xs leading-relaxed">{description}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
