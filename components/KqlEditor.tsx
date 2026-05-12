"use client";

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { MockTable } from "@/lib/types";

type SuggestionKind = "table" | "column" | "operator" | "filter" | "logical";

type Suggestion = {
  label: string;
  insertText: string;
  detail: string;
  kind: SuggestionKind;
};

const KQL_OPERATORS = ["where", "project", "summarize", "count", "sort", "order by", "take", "extend", "distinct"];
const FILTER_OPERATORS = ["contains", "has", "==", "!="];
const LOGICAL_OPERATORS = ["and", "or", "not"];
const TOKEN_MATCHER = /[A-Za-z0-9_.=!]+$/;
const LINE_HEIGHT = 20;
const CHARACTER_WIDTH = 8.4;

type CaretPosition = {
  top: number;
  left: number;
};

function getTokenPrefix(value: string, cursorPosition: number) {
  const beforeCursor = value.slice(0, cursorPosition);
  return beforeCursor.match(TOKEN_MATCHER)?.[0] ?? "";
}

function getActiveTableName(value: string, cursorPosition: number, tableNames: string[]) {
  const beforeCursor = value.slice(0, cursorPosition).toLowerCase();

  return tableNames
    .map((tableName) => ({ tableName, index: beforeCursor.lastIndexOf(tableName.toLowerCase()) }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => right.index - left.index)[0]?.tableName;
}

function createStaticSuggestions(values: string[], kind: SuggestionKind, detail: string): Suggestion[] {
  return values.map((value) => ({ label: value, insertText: value, detail, kind }));
}

function matchesPrefix(suggestion: Suggestion, prefix: string) {
  return !prefix || suggestion.label.toLowerCase().startsWith(prefix.toLowerCase());
}

function getKindStyles(kind: SuggestionKind) {
  switch (kind) {
    case "table":
      return "bg-cyber/10 text-cyber";
    case "column":
      return "bg-sky-300/10 text-sky-200";
    case "filter":
      return "bg-amber-300/10 text-amber-200";
    default:
      return "bg-slate-700 text-slate-200";
  }
}

function getCaretCoordinates(textarea: HTMLTextAreaElement, value: string, cursorPosition: number): CaretPosition {
  const textBeforeCursor = value.slice(0, cursorPosition);
  const lines = textBeforeCursor.split("\n");
  const currentLine = lines[lines.length - 1] ?? "";
  const top = 12 + (lines.length - 1) * LINE_HEIGHT - textarea.scrollTop;
  const left = 16 + currentLine.length * CHARACTER_WIDTH - textarea.scrollLeft;

  return {
    top: Math.max(10, Math.min(top + LINE_HEIGHT, textarea.clientHeight - 8)),
    left: Math.max(12, Math.min(left, textarea.clientWidth - 260))
  };
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
  const [caretPosition, setCaretPosition] = useState<CaretPosition>({ top: 44, left: 16 });
  const [isFocused, setIsFocused] = useState(false);

  const tableNames = useMemo(() => tables.map((table) => table.name), [tables]);
  const allColumnSuggestions = useMemo(() => {
    const seen = new Set<string>();

    return tables.flatMap((table) =>
      table.schema
        .filter((column) => {
          const key = column.column.toLowerCase();
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        })
        .map<Suggestion>((column) => ({
          label: column.column,
          insertText: column.column,
          detail: `Column · ${column.type}`,
          kind: "column"
        }))
    );
  }, [tables]);

  const syntaxSuggestions = useMemo(
    () => [
      ...createStaticSuggestions(KQL_OPERATORS, "operator", "KQL keyword"),
      ...createStaticSuggestions(FILTER_OPERATORS, "filter", "Filter operator"),
      ...createStaticSuggestions(LOGICAL_OPERATORS, "logical", "Logical operator")
    ],
    []
  );

  const prefix = getTokenPrefix(value, cursorPosition);
  const activeTableName = getActiveTableName(value, cursorPosition, tableNames);
  const activeTable = tables.find((table) => table.name === activeTableName);

  const suggestions = useMemo(() => {
    const tableSuggestions = tables.map<Suggestion>((table) => ({
      label: table.name,
      insertText: table.name,
      detail: "Table",
      kind: "table"
    }));
    const activeTableColumns = activeTable
      ? activeTable.schema.map<Suggestion>((column) => ({
          label: column.column,
          insertText: column.column,
          detail: `${activeTable.name} · ${column.type}`,
          kind: "column"
        }))
      : [];
    const allSuggestions = [...tableSuggestions, ...activeTableColumns, ...allColumnSuggestions, ...syntaxSuggestions];
    const uniqueSuggestions = Array.from(new Map(allSuggestions.map((suggestion) => [suggestion.label.toLowerCase(), suggestion])).values());

    return uniqueSuggestions.filter((suggestion) => matchesPrefix(suggestion, prefix)).slice(0, 8);
  }, [activeTable, allColumnSuggestions, prefix, syntaxSuggestions, tables]);

  const shouldShowSuggestions = isFocused && suggestions.length > 0;

  function syncCursorPosition() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const nextPosition = textarea.selectionStart;
    setCursorPosition(nextPosition);
    setCaretPosition(getCaretCoordinates(textarea, textarea.value, nextPosition));
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
      const nextTextarea = textareaRef.current;
      nextTextarea?.focus();
      nextTextarea?.setSelectionRange(nextCursorPosition, nextCursorPosition);
      if (nextTextarea) {
        setCaretPosition(getCaretCoordinates(nextTextarea, nextValue, nextCursorPosition));
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldShowSuggestions) {
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
      setIsFocused(false);
    }
  }

  function handleSuggestionMouseDown(event: MouseEvent<HTMLButtonElement>, suggestion: Suggestion) {
    event.preventDefault();
    insertSuggestion(suggestion);
  }

  return (
    <div className="relative mt-2">
      <textarea
        ref={textareaRef}
        id="query"
        value={value}
        onBlur={() => window.setTimeout(() => setIsFocused(false), 100)}
        onChange={(event) => {
          onChange(event.target.value);
          setCursorPosition(event.target.selectionStart);
          setCaretPosition(getCaretCoordinates(event.target, event.target.value, event.target.selectionStart));
          setActiveIndex(0);
          setIsFocused(true);
        }}
        onClick={syncCursorPosition}
        onFocus={(event) => {
          setIsFocused(true);
          setCaretPosition(getCaretCoordinates(event.target, event.target.value, event.target.selectionStart));
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCursorPosition}
        onScroll={syncCursorPosition}
        onSelect={syncCursorPosition}
        className="kql-editor min-h-72 w-full rounded-2xl border-slate-700 bg-slate-900/95 text-sm text-cyber shadow-inner focus:border-cyber focus:ring-cyber"
        placeholder="SigninLogs&#10;| where ...&#10;| project ..."
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label="KQL query editor"
      />

      {shouldShowSuggestions ? (
        <div
          className="absolute z-20 w-64 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 py-1 shadow-glow"
          style={{ top: caretPosition.top, left: caretPosition.left }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.kind}-${suggestion.label}`}
              type="button"
              onMouseDown={(event) => handleSuggestionMouseDown(event, suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition ${
                index === activeIndex ? "bg-cyber/20 text-white" : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{suggestion.label}</span>
                <span className="block truncate text-[0.68rem] text-slate-500">{suggestion.detail}</span>
              </span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold uppercase ${getKindStyles(suggestion.kind)}`}>
                {suggestion.kind}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
