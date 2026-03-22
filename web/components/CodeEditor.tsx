"use client";

import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  readOnly?: boolean;
}

export default function CodeEditor({
  value,
  onChange,
  language = "java",
  height = "240px",
  readOnly = false,
}: CodeEditorProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v || "")}
        theme="vs-dark"
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
        }}
      />
    </div>
  );
}
