import Link from "next/link";

export function VtaBusinessMark({ inverted = false, centered = false }: { inverted?: boolean; centered?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Accueil VTA Business"
      className={`inline-flex items-center gap-3 ${centered ? "justify-center" : ""}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${inverted ? "border-white/30 bg-white" : "border-slate-200 bg-white"} shadow-sm`}>
        <svg viewBox="0 0 44 44" className="h-10 w-10" role="img" aria-label="Croissance VTA Business">
          <rect x="4" y="4" width="36" height="36" rx="9" fill="#F8FAFC" />
          <rect x="10" y="23" width="6" height="10" rx="2" fill="#059669" />
          <rect x="19" y="17" width="6" height="16" rx="2" fill="#F97316" />
          <rect x="28" y="11" width="6" height="22" rx="2" fill="#2563EB" />
          <path d="M10 35.5H35" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 18L20 12.5L27 15L35 8" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M31.5 8H35V11.5" fill="none" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-left">
        <span className={`block whitespace-nowrap text-xl font-black leading-none ${inverted ? "text-white" : "text-slate-950 dark:text-white"}`}>VTA Business</span>
        <span className={`mt-1 block text-[11px] font-semibold ${inverted ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>une solution de VTA Enterprise</span>
      </span>
    </Link>
  );
}
