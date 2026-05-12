"use client";

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { MockTable } from "@/lib/types";

type SuggestionKind = "table" | "column" | "operator" | "filter" | "logical" | "time";

type Suggestion = {
  label: string;
  insertText: string;
  detail: string;
  kind: SuggestionKind;
};

const KQL_OPERATORS = ["where", "project", "summarize", "count", "sort", "order by", "take", "extend", "distinct"];
const FILTER_OPERATORS = ["contains", "has", "==", "!=", "startswith", "endswith", "in"];
const LOGICAL_OPERATORS = ["and", "or", "not"];
const TIME_HELPERS = ["ago()", "now()", "datetime()"];
const TOKEN_MATCHER = /[A-Za-z0-9_.=!()]+$/;

function getTokenPrefix(value: string, cursorPosition: number) {
  const beforeCursor = value.slice(0, cursorPosition);
  return beforeCursor.match(TOKEN_MATCHER)?.[0] ?? "";
}

function getCurrentPipelineSegment(value: string, cursorPosition: number) {
  const beforeCursor = value.slice(0, cursorPosition);
  const lastPipe = beforeCursor.lastIndexOf("|");
  const lastLineBreak = beforeCursor.lastIndexOf("\n");
  const segmentStart = Math.max(lastPipe, lastLineBreak) + 1;

  return beforeCursor.slice(segmentStart);
}

function isLikelyTablePosition(value: string, cursorPosition: number) {
  const segment = getCurrentPipelineSegment(value, cursorPosition);
  return /^[\sA-Za-z0-9_]*$/.test(segment) && !value.slice(0, cursorPosition).includes("|");
}

function getActiveTableName(value: string, cursorPosition: number, tableNames: string[]) {
  const beforeCursor = value.slice(0, cursorPosition);
  const lowerBeforeCursor = beforeCursor.toLowerCase();

  return tableNames
    .map((tableName) => ({ tableName, index: lowerBeforeCursor.lastIndexOf(tableName.toLowerCase()) }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => right.index - left.index)[0]?.tableName;
}

function createStaticSuggestions(values: string[], kind: SuggestionKind, detail: string): Suggestion[] {
  return values.map((value) => ({
    label: value,
    insertText: value,
    detail,
    kind
  }));
}

function matchesPrefix(suggestion: Suggestion, prefix: string) {
  if (!prefix) {
    return true;
  }

  return suggestion.label.toLowerCase().startsWith(prefix.toLowerCase());
}

function getKindStyles(kind: SuggestionKind) {
  switch (kind) {
    case "table":
      return "border-cyber/30 bg-cyber/10 text-cyber";
    case "column":
      return "border-sky-300/30 bg-sky-300/10 text-sky-200";
    case "time":
      return "border-purple-300/30 bg-purple-300/10 text-purple-200";
    default:
      return "border-slate-500/30 bg-slate-700/60 text-slate-200";
  }
}

export function KqlEditor({
  value,
  onChange,
  tables
}: {
  value: string;
  onChange: (value: string) => void;
  tables: MockTable[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const tableNames = useMemo(() => tables.map((table) => table.name), [tables]);
  const allSuggestions = useMemo(() => {
    const tableSuggestions = tables.map<Suggestion>((table) => ({
      label: table.name,
      insertText: table.name,
      detail: "Table",
      kind: "table"
    }));

    return [
      ...tableSuggestions,
      ...createStaticSuggestions(KQL_OPERATORS, "operator", "KQL operator"),
      ...createStaticSuggestions(FILTER_OPERATORS, "filter", "Filter operator"),
      ...createStaticSuggestions(LOGICAL_OPERATORS, "logical", "Logical operator"),
      ...createStaticSuggestions(TIME_HELPERS, "time", "Time helper")
    ];
  }, [tables]);

  const prefix = getTokenPrefix(value, cursorPosition);
  const activeTableName = getActiveTableName(value, cursorPosition, tableNames);
  const activeTable = tables.find((table) => table.name === activeTableName);

  const suggestions = useMemo(() => {
    const columnSuggestions = activeTable
      ? activeTable.schema.map<Suggestion>((column) => ({
          label: column.column,
          insertText: column.column,
          detail: `${activeTable.name} column · ${column.type}`,
          kind: "column"
        }))
      : [];

    const tableSuggestions = isLikelyTablePosition(value, cursorPosition)
      ? tables.map<Suggestion>((table) => ({
          label: table.name,
          insertText: table.name,
          detail: "Table",
          kind: "table"
        }))
      : [];

    const syntaxSuggestions = allSuggestions.filter((suggestion) => suggestion.kind !== "table");
    const availableSuggestions = [...tableSuggestions, ...columnSuggestions, ...syntaxSuggestions];
    const uniqueSuggestions = Array.from(new Map(availableSuggestions.map((suggestion) => [suggestion.label, suggestion])).values());

    return uniqueSuggestions.filter((suggestion) => matchesPrefix(suggestion, prefix)).slice(0, 10);
  }, [activeTable, allSuggestions, cursorPosition, prefix, tables, value]);

  function syncCursorPosition() {
    const nextPosition = textareaRef.current?.selectionStart ?? 0;
    setCursorPosition(nextPosition);
    setActiveIndex(0);
  }

  function insertSuggestion(suggestion: Suggestion) {
    const textarea = textareaRef.current;
    const insertionPoint = textarea?.selectionStart ?? cursorPosition;
    const selectionEnd = textarea?.selectionEnd ?? insertionPoint;
    const tokenPrefix = getTokenPrefix(value, insertionPoint);
    const replacementStart = insertionPoint - tokenPrefix.length;
    const nextValue = `${value.slice(0, replacementStart)}${suggestion.insertText}${value.slice(selectionEnd)}`;
    const nextCursorPosition = replacementStart + suggestion.insertText.length;

    onChange(nextValue);
    setCursorPosition(nextCursorPosition);
    setActiveIndex(0);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      insertSuggestion(suggestions[activeIndex] ?? suggestions[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setActiveIndex(0);
      setCursorPosition(value.length + 1);
    }
  }

  function handleSuggestionMouseDown(event: MouseEvent<HTMLButtonElement>, suggestion: Suggestion) {
    event.preventDefault();
    insertSuggestion(suggestion);
  }

  return (
    <div className="mt-2">
      <textarea
        ref={textareaRef}
        id="query"
        value={value}
        onBlur={syncCursorPosition}
        onChange={(event) => {
          onChange(event.target.value);
          setCursorPosition(event.target.selectionStart);
          setActiveIndex(0);
        }}
        onClick={syncCursorPosition}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCursorPosition}
        onSelect={syncCursorPosition}
        className="kql-editor min-h-72 w-full rounded-2xl border-slate-700 bg-slate-900/95 text-sm text-cyber shadow-inner focus:border-cyber focus:ring-cyber"
        placeholder="SigninLogs&#10;| where ...&#10;| project ..."
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-describedby="kql-suggestions"
      />

      <div id="kql-suggestions" className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/90 p-2 shadow-inner">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-slate-500">
          <span>Autocomplete uses only available table schemas and KQL syntax.</span>
          <span>Tab / Enter inserts</span>
        </div>
        {suggestions.length ? (
          <div className="grid gap-1 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.kind}-${suggestion.label}`}
                type="button"
                onMouseDown={(event) => handleSuggestionMouseDown(event, suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                  index === activeIndex
                    ? "border-cyber/60 bg-cyber/10 text-white"
                    : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{suggestion.label}</span>
                  <span className="block truncate text-xs text-slate-500">{suggestion.detail}</span>
                </span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase ${getKindStyles(suggestion.kind)}`}>
                  {suggestion.kind}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm text-slate-500">Start typing a table, column, operator, or time helper.</p>
        )}
      </div>
    </div>
  );
}
