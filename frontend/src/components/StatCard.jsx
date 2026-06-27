export default function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-4 py-3 text-center shadow-sm">
      <div className="font-display text-3xl font-bold text-brand-900 leading-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      <div className="text-[10px] font-semibold text-slate-500 mt-0.5 tracking-wide uppercase">{label}</div>
    </div>
  );
}
