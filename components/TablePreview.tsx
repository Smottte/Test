import type { MockTable } from "@/lib/types";

export function TablePreview({ table }: { table: MockTable }) {
  return (
    <details className="group rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 open:bg-slate-950">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span>
          <span className="block text-lg font-bold text-white">{table.name}</span>
          <span className="text-sm text-slate-400">{table.description}</span>
        </span>
        <span className="rounded-full bg-cyber/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyber">
          Schema
        </span>
      </summary>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="px-3 py-2">Column</th>
              <th className="px-3 py-2">Type</th>
              <th className="hidden px-3 py-2 md:table-cell">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {table.schema.map((column) => (
              <tr key={column.column}>
                <td className="px-3 py-2 font-semibold text-white">{column.column}</td>
                <td className="px-3 py-2">{column.type}</td>
                <td className="hidden px-3 py-2 text-slate-400 md:table-cell">{column.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
