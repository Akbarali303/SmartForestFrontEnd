type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
};

export default function StatCard({ title, value, icon, trend, trendUp, className = '' }: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
          {trend != null && (
            <p className={`mt-1 text-xs font-medium ${trendUp ? 'text-forest-600' : 'text-red-500'}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-forest-100 text-forest-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
