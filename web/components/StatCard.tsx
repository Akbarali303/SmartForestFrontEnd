type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  /** Qisqa birlik yoki izoh (masalan "ga", "ta") */
  subtitle?: string;
  className?: string;
};

export default function StatCard({ title, value, icon, trend, trendUp, subtitle, className = '' }: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-800">{value}</p>
          {(subtitle != null || trend != null) && (
            <p className={`mt-0.5 text-xs ${trend != null ? (trendUp ? 'text-forest-600 font-medium' : 'text-red-600 font-medium') : 'text-slate-500'}`}>
              {trend ?? subtitle}
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center shrink-0 border border-forest-100/80">
          {icon}
        </div>
      </div>
    </div>
  );
}
