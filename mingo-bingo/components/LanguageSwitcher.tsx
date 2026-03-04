"use client";

import { Locale, localeLabels } from "@/lib/i18n";
import { useTranslations } from "@/components/LanguageProvider";

const LOCALES: Locale[] = ["en", "fr", "es"];

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslations();

  return (
    <div className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`px-2 py-0.5 rounded text-xs font-semibold tracking-wider uppercase transition-colors ${
            locale === l
              ? "bg-zinc-700 text-white"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
