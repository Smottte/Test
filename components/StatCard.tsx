type StatCardProps = {
  label: string;
  value: string | number;
  caption: string;
};

export function StatCard({ label, value, caption }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-glow backdrop-blur">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{caption}</p>
    </div>
  );
}
