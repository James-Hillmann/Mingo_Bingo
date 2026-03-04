"use client";

import { useTranslations } from "@/components/LanguageProvider";

interface SongButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function SongButton({ onClick, disabled }: SongButtonProps) {
  const { t } = useTranslations();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full rounded-2xl font-black text-2xl tracking-wide
        transition-all duration-100 select-none
        ${
          disabled
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-emerald-500 hover:bg-emerald-400 active:scale-95 active:bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 cursor-pointer"
        }
      `}
      style={{ minHeight: "96px" }}
    >
      {disabled ? t.allSongsCalled : t.songPlayed}
    </button>
  );
}
