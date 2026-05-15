import type { MockTable } from "@/lib/types";

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  error?: string;
};

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function parseLiteral(value: string) {
  const trimmed = stripQuotes(value);
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) || trimmed === "" ? trimmed : numeric;
}

function compareValues(rowValue: unknown, operator: string, expectedRaw: string) {
  const expected = parseLiteral(expectedRaw);

  switch (operator.toLowerCase()) {
    case "==":
      return normalize(rowValue) === normalize(expected);
    case "!=":
      return normalize(rowValue) !== normalize(expected);
    case "contains":
    case "has":
      return normalize(rowValue).includes(normalize(expected));
    case "startswith":
      return normalize(rowValue).startsWith(normalize(expected));
    case "endswith":
      return normalize(rowValue).endsWith(normalize(expected));
    case "in": {
      const options = expectedRaw
        .replace(/^[\s(]+|[\s)]+$/g, "")
        .split(",")
        .map((option) => normalize(stripQuotes(option)))
        .filter(Boolean);
      return options.includes(normalize(rowValue));
    }
    default:
      return false;
  }
}

function applyWhere(rows: Record<string, unknown>[], expression: string) {
  const orGroups = expression.split(/\s+or\s+/i).map((group) => group.trim()).filter(Boolean);

  return rows.filter((row) =>
    orGroups.some((group) => {
      const andConditions = group.split(/\s+and\s+/i).map((condition) => condition.trim()).filter(Boolean);

      return andConditions.every((condition) => {
        const match = condition.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|contains|has|startswith|endswith|in)\s*(.+)$/i);
        if (!match) {
          throw new Error(`Unsupported where condition: ${condition}`);
        }

        return compareValues(row[match[1]], match[2], match[3]);
      });
    })
  );
}

function getColumns(rows: Record<string, unknown>[], fallbackColumns: string[]) {
  if (!rows.length) {
    return fallbackColumns;
  }

  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
}

function applyProject(rows: Record<string, unknown>[], expression: string) {
  const columns = expression.split(",").map((column) => column.trim()).filter(Boolean);
  return {
    columns,
    rows: rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
  };
}

function applyDistinct(rows: Record<string, unknown>[], expression: string) {
  const columns = expression.split(",").map((column) => column.trim()).filter(Boolean);
  const seen = new Set<string>();
  const distinctRows = rows
    .map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
    .filter((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return { columns, rows: distinctRows };
}

function applySort(rows: Record<string, unknown>[], expression: string) {
  const match = expression.match(/^(?:by\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s+(asc|desc))?$/i);
  if (!match) {
    throw new Error(`Unsupported sort expression: ${expression}`);
  }

  const [, column, direction = "asc"] = match;
  return [...rows].sort((left, right) => {
    const leftValue = left[column];
    const rightValue = right[column];
    const comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { numeric: true });
    return direction.toLowerCase() === "desc" ? -comparison : comparison;
  });
}

function applyExtend(rows: Record<string, unknown>[], columns: string[], expression: string) {
  const assignments = expression.split(",").map((assignment) => assignment.trim()).filter(Boolean);
  const aliases: string[] = [];

  const extendedRows = rows.map((row) => {
    const nextRow = { ...row };
    for (const assignment of assignments) {
      const match = assignment.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (!match) {
        throw new Error(`Unsupported extend expression: ${assignment}`);
      }

      const [, alias, source] = match;
      aliases.push(alias);
      const sourceColumn = source.trim();
      nextRow[alias] = Object.prototype.hasOwnProperty.call(row, sourceColumn) ? row[sourceColumn] : parseLiteral(sourceColumn);
    }
    return nextRow;
  });

  return { columns: Array.from(new Set([...columns, ...aliases])), rows: extendedRows };
}

function applySummarize(rows: Record<string, unknown>[], expression: string) {
  const [aggregatePart, byPart] = expression.split(/\s+by\s+/i);
  const groupColumns = byPart?.split(",").map((column) => column.trim()).filter(Boolean) ?? [];

  if (!groupColumns.length) {
    return { columns: ["Count"], rows: [{ Count: rows.length }] };
  }

  const groups = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const groupValues = Object.fromEntries(groupColumns.map((column) => [column, row[column]]));
    const key = JSON.stringify(groupValues);
    if (!groups.has(key)) {
      groups.set(key, { ...groupValues, Count: 0 });
    }
    const group = groups.get(key)!;
    group.Count = Number(group.Count) + 1;

    const makeSetMatches = aggregatePart.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*make_set\(([A-Za-z_][A-Za-z0-9_]*)\)/gi);
    for (const match of makeSetMatches) {
      const [, alias, sourceColumn] = match;
      const existing = Array.isArray(group[alias]) ? (group[alias] as unknown[]) : [];
      const nextValue = row[sourceColumn];
      group[alias] = existing.includes(nextValue) ? existing : [...existing, nextValue];
    }
  }

  const aggregateColumns = Array.from(aggregatePart.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*make_set/gi)).map((match) => match[1]);
  const columns = [...groupColumns, ...(aggregateColumns.length ? aggregateColumns : ["Count"])];
  return { columns, rows: Array.from(groups.values()).map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))) };
}

export function runKqlQuery(query: string, tables: MockTable[]): QueryResult {
  const statements = query.split("|").map((statement) => statement.trim()).filter(Boolean);
  if (!statements.length) {
    return { columns: [], rows: [], error: "Enter a KQL query before running it." };
  }

  const table = tables.find((candidate) => candidate.name.toLowerCase() === statements[0].toLowerCase());
  if (!table) {
    return { columns: [], rows: [], error: `Unknown table: ${statements[0]}` };
  }

  let rows = [...table.rows];
  let columns = table.schema.map((column) => column.column);

  try {
    for (const statement of statements.slice(1)) {
      if (/^where\s+/i.test(statement)) {
        rows = applyWhere(rows, statement.replace(/^where\s+/i, ""));
        columns = getColumns(rows, columns);
        continue;
      }

      if (/^project\s+/i.test(statement)) {
        const projected = applyProject(rows, statement.replace(/^project\s+/i, ""));
        rows = projected.rows;
        columns = projected.columns;
        continue;
      }

      if (/^take\s+/i.test(statement)) {
        const amount = Number(statement.replace(/^take\s+/i, ""));
        if (Number.isNaN(amount)) {
          throw new Error(`Invalid take amount: ${statement}`);
        }
        rows = rows.slice(0, amount);
        continue;
      }

      if (/^(sort|order)\s+by\s+/i.test(statement)) {
        rows = applySort(rows, statement.replace(/^(sort|order)\s+/i, ""));
        continue;
      }

      if (/^distinct\s+/i.test(statement)) {
        const distinct = applyDistinct(rows, statement.replace(/^distinct\s+/i, ""));
        rows = distinct.rows;
        columns = distinct.columns;
        continue;
      }

      if (/^extend\s+/i.test(statement)) {
        const extended = applyExtend(rows, columns, statement.replace(/^extend\s+/i, ""));
        rows = extended.rows;
        columns = extended.columns;
        continue;
      }

      if (/^count$/i.test(statement)) {
        rows = [{ Count: rows.length }];
        columns = ["Count"];
        continue;
      }

      if (/^summarize\s+/i.test(statement)) {
        const summarized = applySummarize(rows, statement.replace(/^summarize\s+/i, ""));
        rows = summarized.rows;
        columns = summarized.columns;
        continue;
      }

      throw new Error(`Unsupported KQL command: ${statement}`);
    }
  } catch (error) {
    return { columns: [], rows: [], error: error instanceof Error ? error.message : "Invalid KQL query." };
  }

  return { columns, rows };
}
