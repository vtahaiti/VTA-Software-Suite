type VtaPosBrandProps = {
  compact?: boolean;
  className?: string;
};

export function VtaPosBrand({ compact = false, className = "" }: VtaPosBrandProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`.trim()} aria-label="VTA POS">
      <span className={`${compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl"} relative inline-flex shrink-0 items-end justify-center gap-[2px] overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 p-1.5 shadow-sm`} aria-hidden="true">
        <span className="h-[35%] w-[5px] rounded-sm bg-orange-500" />
        <span className="h-[58%] w-[5px] rounded-sm bg-amber-400" />
        <span className="h-[82%] w-[5px] rounded-sm bg-emerald-500" />
      </span>
      <span className={`${compact ? "text-lg" : "text-2xl"} whitespace-nowrap font-black tracking-tight text-[#182858]`}>
        VTA <span className="text-[#2563EB]">POS</span>
      </span>
    </div>
  );
}
