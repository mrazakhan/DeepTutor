"use client";

/**
 * MCQExplanation — structured, option-by-option explanation panel.
 *
 * Parses the raw LLM explanation text into:
 *   1. A "Why correct answer is right" block
 *   2. Per-option cards (each expandable) explaining why that option is right or wrong
 */

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { processLatexContent } from "@/lib/latex";

interface MCQExplanationProps {
  explanation: string;
  correctAnswer: string;        // e.g. "D"
  selectedAnswer: string;       // e.g. "A"
  options: Record<string, string>; // e.g. { A: "...", B: "...", C: "...", D: "..." }
}

// Pull out per-option blurbs from explanation text.
// Looks for patterns like: "Option A:", "A.", "A)", "**Option A**"
function parseOptionSections(
  text: string,
  optionKeys: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  // Build a regex that finds "Option X" or standalone "X." or "X)" headings
  const pattern = new RegExp(
    `(?:Option\\s+|\\*{0,2})([${optionKeys.join("")}])(?:\\*{0,2})[.):)]?\\s*(?:–|—|-)?\\s*`,
    "gi"
  );

  // Find all split points
  const splits: Array<{ letter: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    splits.push({ letter: m[1].toUpperCase(), index: m.index });
  }

  for (let i = 0; i < splits.length; i++) {
    const { letter, index } = splits[i];
    const end = i + 1 < splits.length ? splits[i + 1].index : text.length;
    const chunk = text.slice(index, end).trim();
    // Strip the leading "Option X:" header itself
    const body = chunk.replace(
      new RegExp(`^(?:Option\\s+)?\\*{0,2}${letter}\\*{0,2}[.):)]?\\s*(?:–|—|-)?\\s*`, "i"),
      ""
    ).trim();
    if (body) result[letter] = body;
  }
  return result;
}

// Extract the "preamble" before the first option section, which is usually
// the main explanation of why the correct answer is right.
function extractPreamble(text: string, optionKeys: string[]): string {
  const pattern = new RegExp(
    `(?:Option\\s+)?(?:\\*{0,2})[${optionKeys.join("")}](?:\\*{0,2})[.):)]`,
    "i"
  );
  const m = text.search(pattern);
  return m > 0 ? text.slice(0, m).trim() : text.trim();
}

// Inline-safe markdown render (no outer <p> wrapper)
function InlineMD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children: c }) => <span className="block mb-1 last:mb-0">{c}</span>,
        code: ({ inline, children: c, ...rest }: any) =>
          inline ? (
            <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
              {c}
            </code>
          ) : (
            <pre className="mt-1 mb-1 p-2 bg-slate-800 dark:bg-slate-900 rounded text-xs font-mono overflow-x-auto whitespace-pre text-slate-100">
              <code>{c}</code>
            </pre>
          ),
      }}
    >
      {processLatexContent(children)}
    </ReactMarkdown>
  );
}

export default function MCQExplanation({
  explanation,
  correctAnswer,
  selectedAnswer,
  options,
}: MCQExplanationProps) {
  const optionKeys = Object.keys(options).sort();
  const isCorrect = selectedAnswer === correctAnswer;

  const preamble = extractPreamble(explanation, optionKeys);
  const perOption = parseOptionSections(explanation, optionKeys);

  // Expand incorrect options by default, keep correct collapsed
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(optionKeys.map((k) => [k, k !== correctAnswer]))
  );

  const toggle = (k: string) =>
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));

  const letterColors: Record<string, { bg: string; text: string; border: string }> = {
    A: { bg: "bg-blue-500/10 dark:bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", border: "border-blue-300 dark:border-blue-700" },
    B: { bg: "bg-violet-500/10 dark:bg-violet-500/15", text: "text-violet-600 dark:text-violet-400", border: "border-violet-300 dark:border-violet-700" },
    C: { bg: "bg-emerald-500/10 dark:bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-700" },
    D: { bg: "bg-amber-500/10 dark:bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", border: "border-amber-300 dark:border-amber-700" },
  };

  return (
    <div className="space-y-3 text-sm">
      {/* Result header */}
      <div
        className={`flex items-center gap-2 font-semibold text-base ${
          isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        }`}
      >
        {isCorrect ? (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 flex-shrink-0" />
        )}
        {isCorrect
          ? "Correct!"
          : `Incorrect — correct answer: (${correctAnswer})`}
      </div>

      {/* Main preamble explanation */}
      {preamble && (
        <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
          <InlineMD>{preamble}</InlineMD>
        </div>
      )}

      {/* Per-option breakdown */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Option-by-option breakdown
        </p>
        {optionKeys.map((letter) => {
          const isThisCorrect = letter === correctAnswer;
          const isThisSelected = letter === selectedAnswer;
          const optionExplanation = perOption[letter];
          const col = letterColors[letter] || letterColors.A;

          return (
            <div
              key={letter}
              className={`rounded-lg border ${
                isThisCorrect
                  ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/20"
                  : isThisSelected
                  ? "border-red-300 dark:border-red-700 bg-red-50/60 dark:bg-red-900/20"
                  : `${col.border} ${col.bg}`
              }`}
            >
              <button
                className="w-full text-left px-3 py-2 flex items-center gap-2.5"
                onClick={() => toggle(letter)}
              >
                {/* Letter badge */}
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white ${
                    isThisCorrect
                      ? "bg-emerald-500"
                      : isThisSelected
                      ? "bg-red-500"
                      : "bg-slate-400 dark:bg-slate-600"
                  }`}
                >
                  {letter}
                </span>

                {/* Option text (truncated) */}
                <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate font-mono">
                  {options[letter]}
                </span>

                {/* Status icon */}
                {isThisCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : isThisSelected ? (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : null}

                {/* Expand chevron */}
                {optionExplanation ? (
                  expanded[letter] ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )
                ) : null}
              </button>

              {/* Expanded explanation */}
              {expanded[letter] && optionExplanation && (
                <div className="px-4 pb-3 pt-0 border-t border-slate-200/60 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <InlineMD>{optionExplanation}</InlineMD>
                </div>
              )}

              {/* Correct answer — always show explanation */}
              {isThisCorrect && !expanded[letter] && !optionExplanation && (
                <div className="px-4 pb-2 text-xs text-emerald-600 dark:text-emerald-400 italic">
                  This is the correct answer.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
