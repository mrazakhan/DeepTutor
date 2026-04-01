"use client";

import { CheckCircle2, XCircle } from "lucide-react";
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

export default function MCQExplanation({
  explanation,
  correctAnswer,
  selectedAnswer,
}: MCQExplanationProps) {
  const isCorrect = selectedAnswer === correctAnswer;

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
        {isCorrect ? "Correct!" : `Incorrect — correct answer: (${correctAnswer})`}
      </div>

      {/* Explanation */}
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: ({ className, children: c, ...rest }: any) => {
              const isBlock = !!className?.startsWith("language-") || String(c).includes("\n");
              if (!isBlock) {
                return (
                  <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-800 dark:text-slate-200">
                    {c}
                  </code>
                );
              }
              const lines = String(c).replace(/\n$/, "").split("\n");
              return (
                <div className="my-2 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs font-mono leading-relaxed">
                      <tbody>
                        {lines.map((line, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="select-none text-right pr-3 pl-3 py-px w-8 border-r border-slate-700/60 text-slate-500 text-xs align-top" style={{ minWidth: "2rem" }}>{i + 1}</td>
                            <td className="pl-4 pr-4 py-px text-slate-100 whitespace-pre">{line || "\u00a0"}</td>
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
          {processLatexContent(explanation)}
        </ReactMarkdown>
      </div>
    </div>
  );
}
