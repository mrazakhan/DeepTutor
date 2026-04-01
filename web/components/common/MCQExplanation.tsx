"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { processLatexContent } from "@/lib/latex";

interface MCQExplanationProps {
  explanation: string;
  correctAnswer: string;
  selectedAnswer: string;
  options: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Extract the blurb before the first per-option section. */
function extractPreamble(text: string, optionKeys: string[]): string {
  const pattern = new RegExp(
    `(?:Option\\s+)?(?:\\*{0,2})[${optionKeys.join("")}](?:\\*{0,2})[.):)]`,
    "i"
  );
  const m = text.search(pattern);
  return m > 0 ? text.slice(0, m).trim() : text.trim();
}

/** Extract per-option explanation blurbs from the LLM output. */
function parseOptionSections(
  text: string,
  optionKeys: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = new RegExp(
    `(?:Option\\s+|\\*{0,2})([${optionKeys.join("")}])(?:\\*{0,2})(?:[.):)]|\\s*[-–—])\\s*`,
    "gi"
  );

  const splits: Array<{ letter: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    splits.push({ letter: m[1].toUpperCase(), index: m.index });
  }

  for (let i = 0; i < splits.length; i++) {
    const { letter, index } = splits[i];
    const end = i + 1 < splits.length ? splits[i + 1].index : text.length;
    const chunk = text.slice(index, end).trim();
    const body = chunk
      .replace(
        new RegExp(
          `^(?:Option\\s+)?\\*{0,2}${letter}\\*{0,2}(?:[.):)]|\\s*[-–—])?\\s*`,
          "i"
        ),
        ""
      )
      .trim();
    if (body) result[letter] = body;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Markdown renderer (inline-safe, with line-numbered code blocks)
// ---------------------------------------------------------------------------
function MD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children: c }) => <span className="block mb-1.5 last:mb-0">{c}</span>,
        code: ({ className, children: c, ...rest }: any) => {
          const isBlock =
            !!className?.startsWith("language-") || String(c).includes("\n");
          if (!isBlock) {
            return (
              <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-800 dark:text-slate-200">
                {c}
              </code>
            );
          }
          const lines = String(c).replace(/\n$/, "").split("\n");
          return (
            <div className="not-prose my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs font-mono leading-normal">
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b border-slate-200 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                        <td
                          className="select-none text-right pr-3 pl-3 py-0.5 w-8 border-r border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 text-xs align-top"
                          style={{ minWidth: "2rem" }}
                        >
                          {i + 1}
                        </td>
                        <td className="pl-4 pr-4 py-0.5 text-slate-800 dark:text-slate-100 whitespace-pre">
                          {line || "\u00a0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        },
        pre: ({ children }: any) => <>{children}</>,
      }}
    >
      {processLatexContent(children)}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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

  // Card order: correct answer first, then the rest alphabetically
  const orderedKeys = [
    correctAnswer,
    ...optionKeys.filter((k) => k !== correctAnswer),
  ];

  const [cardIndex, setCardIndex] = useState(0);
  const currentKey = orderedKeys[cardIndex];
  const isCurrentCorrect = currentKey === correctAnswer;
  const isCurrentSelected = currentKey === selectedAnswer;
  const cardExplanation = perOption[currentKey] || (cardIndex === 0 ? preamble : "");

  // Colour tokens per card state
  const headerBg = isCurrentCorrect
    ? "bg-emerald-50 dark:bg-emerald-900/30"
    : isCurrentSelected
    ? "bg-red-50 dark:bg-red-900/30"
    : "bg-slate-50 dark:bg-slate-700/40";

  const headerBorder = isCurrentCorrect
    ? "border-emerald-200 dark:border-emerald-700"
    : isCurrentSelected
    ? "border-red-200 dark:border-red-700"
    : "border-slate-200 dark:border-slate-600";

  const badgeBg = isCurrentCorrect
    ? "bg-emerald-500"
    : isCurrentSelected
    ? "bg-red-500"
    : "bg-slate-400 dark:bg-slate-500";

  const labelColor = isCurrentCorrect
    ? "text-emerald-700 dark:text-emerald-300"
    : isCurrentSelected
    ? "text-red-600 dark:text-red-300"
    : "text-slate-600 dark:text-slate-300";

  const cardBorder = isCurrentCorrect
    ? "border-emerald-300 dark:border-emerald-700"
    : isCurrentSelected
    ? "border-red-300 dark:border-red-700"
    : "border-slate-200 dark:border-slate-600";

  return (
    <div className="flex flex-col gap-3 text-sm h-full">
      {/* ── Result header ── */}
      <div
        className={`flex items-center gap-2 font-semibold text-base ${
          isCorrect
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        }`}
      >
        {isCorrect ? (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 flex-shrink-0" />
        )}
        {isCorrect ? "Correct!" : `Incorrect — correct answer: (${correctAnswer})`}
      </div>

      {/* ── Option explanation card ── */}
      <div className={`rounded-xl border ${cardBorder} overflow-hidden flex flex-col flex-1`}>
        {/* Card header — green / red / neutral */}
        <div className={`px-4 py-2.5 flex items-center gap-2.5 border-b ${headerBg} ${headerBorder}`}>
          <span
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${badgeBg}`}
          >
            {currentKey}
          </span>
          <span className={`font-semibold text-sm ${labelColor}`}>
            {isCurrentCorrect
              ? "✓ Correct Answer"
              : isCurrentSelected
              ? "✗ Your Answer"
              : `Option ${currentKey}`}
          </span>
          {isCurrentCorrect && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" />
          )}
          {isCurrentSelected && !isCurrentCorrect && (
            <XCircle className="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />
          )}
        </div>

        {/* Option text */}
        <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/30 italic">
          {options[currentKey]}
        </div>

        {/* Explanation body */}
        <div className="px-4 py-3 text-slate-700 dark:text-slate-300 leading-relaxed flex-1 overflow-y-auto">
          {cardExplanation ? (
            <MD>{cardExplanation}</MD>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 italic text-xs">
              No specific explanation for this option.
            </span>
          )}
        </div>

        {/* Navigation footer */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-2">
          <button
            onClick={() => setCardIndex((p) => p - 1)}
            disabled={cardIndex === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {orderedKeys.map((k, i) => (
              <button
                key={k}
                onClick={() => setCardIndex(i)}
                className={`rounded-full transition-all ${
                  i === cardIndex
                    ? k === correctAnswer
                      ? "w-5 h-2 bg-emerald-500"
                      : k === selectedAnswer
                      ? "w-5 h-2 bg-red-400"
                      : "w-5 h-2 bg-slate-400"
                    : k === correctAnswer
                    ? "w-2 h-2 bg-emerald-300 dark:bg-emerald-700"
                    : k === selectedAnswer
                    ? "w-2 h-2 bg-red-300 dark:bg-red-700"
                    : "w-2 h-2 bg-slate-300 dark:bg-slate-600"
                }`}
                title={`Option ${k}`}
              />
            ))}
          </div>

          <button
            onClick={() => setCardIndex((p) => p + 1)}
            disabled={cardIndex === orderedKeys.length - 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
