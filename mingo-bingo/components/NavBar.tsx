"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/tracker", label: "Tracker" },
  { href: "/boards", label: "Boards" },
  { href: "/songs", label: "Songs" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950 border-b border-zinc-800 flex h-12">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex items-center justify-center text-sm font-semibold tracking-wide transition-colors
              ${active
                ? "text-white border-b-2 border-white"
                : "text-zinc-500 hover:text-zinc-300"
              }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
