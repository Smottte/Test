import type { MockTable } from "@/lib/types";

function formatValue(value: unknown) {
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

export function TablePreview({ table }: { table: MockTable }) {
  const columns = table.schema.map((column) => column.column);

  return (
    <details className="group rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 open:bg-slate-950">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span>
          <span className="block text-lg font-bold text-white">{table.name}</span>
          <span className="text-sm text-slate-400">{table.description}</span>
        </span>
        <span className="rounded-full bg-cyber/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyber">
          {table.rows.length} rows
        </span>
      </summary>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="px-3 py-2">Column</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {table.schema.map((column) => (
                <tr key={column.column}>
                  <td className="px-3 py-2 font-semibold text-white">{column.column}</td>
                  <td className="px-3 py-2">{column.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-2">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {table.rows.slice(0, 4).map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className="max-w-56 truncate whitespace-nowrap px-3 py-2">
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
