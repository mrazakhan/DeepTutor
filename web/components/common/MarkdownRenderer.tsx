"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { processLatexContent } from "@/lib/latex";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: "default" | "compact" | "prose";
}

/**
 * Shared MarkdownRenderer component with KaTeX support and consistent table styling
 */
export default function MarkdownRenderer({
  content,
  className = "",
  variant = "default",
}: MarkdownRendererProps) {
  // Table components with consistent styling
  const tableComponents = {
    table: ({ node, ...props }: any) => (
      <div
        className={`overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm ${
          variant === "compact" ? "my-2" : "my-4"
        }`}
      >
        <table
          className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm"
          {...props}
        />
      </div>
    ),
    thead: ({ node, ...props }: any) => (
      <thead className="bg-slate-50 dark:bg-slate-800" {...props} />
    ),
    th: ({ node, ...props }: any) => (
      <th
        className={`text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap border-b border-slate-200 dark:border-slate-700 ${
          variant === "compact" ? "px-2 py-1.5" : "px-3 py-2"
        }`}
        {...props}
      />
    ),
    tbody: ({ node, ...props }: any) => (
      <tbody
        className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900"
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td
        className={`text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 ${
          variant === "compact" ? "px-2 py-1.5" : "px-3 py-2"
        }`}
        {...props}
      />
    ),
    tr: ({ node, ...props }: any) => (
      <tr
        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        {...props}
      />
    ),
  };

  // Code block styling with line numbers
  const codeComponents = {
    code: ({
      node,
      className: codeClassName,
      children,
      ...props
    }: any) => {
      // react-markdown v8+ removed `inline` prop; detect inline via className absence and no newlines
      const isInline = !codeClassName?.startsWith("language-") && !String(children).includes("\n");
      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      // Block code: render with line numbers
      const codeString = String(children).replace(/\n$/, "");
      const lines = codeString.split("\n");
      return (
        <div className="not-prose my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm font-mono leading-normal">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-slate-200 dark:border-slate-800/60 last:border-b-0 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                    <td
                      className="select-none text-right pr-3 pl-3 py-0.5 w-10 border-r border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 text-xs align-top"
                      style={{ minWidth: "2.5rem" }}
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
    pre: ({ node, children, ...props }: any) => (
      <pre className="my-0 bg-transparent p-0" {...props}>
        {children}
      </pre>
    ),
  };

  const proseClasses =
    variant === "prose"
      ? "prose prose-slate dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl max-w-none"
      : "prose prose-sm max-w-none";

  return (
    <div className={`${proseClasses} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          ...tableComponents,
          ...codeComponents,
        }}
      >
        {processLatexContent(content)}
      </ReactMarkdown>
    </div>
  );
}
