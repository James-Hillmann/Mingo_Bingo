import { LanguageProvider } from "@/components/LanguageProvider";

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
