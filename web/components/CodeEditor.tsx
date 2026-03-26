"use client";

import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  readOnly?: boolean;
  /** Line numbers to highlight as errors (1-based) */
  errorLines?: number[];
}

export default function CodeEditor({
  value,
  onChange,
  language = "java",
  height = "240px",
  readOnly = false,
  errorLines,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Apply error-line decorations whenever errorLines changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Clear previous decorations
    if (decorationsRef.current) {
      decorationsRef.current.clear();
      decorationsRef.current = null;
    }

    if (errorLines && errorLines.length > 0) {
      const decorations = errorLines.map((line) => ({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "error-line-highlight",
          glyphMarginClassName: "error-line-glyph",
          overviewRuler: {
            color: "#ef4444",
            position: 4, // OverviewRulerLane.Full
          },
        },
      }));
      decorationsRef.current = editor.createDecorationsCollection(decorations);
    }
  }, [errorLines]);

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
      <style jsx global>{`
        .error-line-highlight {
          background-color: rgba(239, 68, 68, 0.15) !important;
          border-left: 3px solid #ef4444 !important;
        }
        .error-line-glyph {
          background-color: #ef4444;
          border-radius: 50%;
          margin-left: 5px;
          width: 8px !important;
          height: 8px !important;
          margin-top: 6px;
        }
      `}</style>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v || "")}
        theme="vs-dark"
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          readOnly,
          tabSize: 4,
          padding: { top: 8, bottom: 8 },
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: "always",
          suggestOnTriggerCharacters: false,
          quickSuggestions: false,
          glyphMargin: errorLines && errorLines.length > 0,
        }}
      />
    </div>
  );
}
