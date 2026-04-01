"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import dynamic from "next/dynamic";
import { processLatexContent } from "@/lib/latex";

const ConceptVisualizer = dynamic(() => import("./ConceptVisualizer"), {
  ssr: false,
});

interface StepByStepViewerProps {
  content: string;
  onDone: () => void;
  topicTitle?: string;
}

// ─── Marker parsing ─────────────────────────────────────────────────────────
// The AI embeds [VISUALIZE:type] markers in its markdown response.
// We parse these out and render ConceptVisualizer components inline.

const VISUALIZE_REGEX = /\[VISUALIZE:([a-z_]+)\]/gi;

/** Strip [VISUALIZE:...] markers from text for display */
function stripMarkers(text: string): string {
  return text.replace(VISUALIZE_REGEX, "").trim();
}

/**
 * Split a block of text around [VISUALIZE:type] markers.
 * Returns an array of segments: { type: "text", content } or { type: "viz", vizType }.
 */
interface TextSegment {
  type: "text";
  content: string;
}
interface VizSegment {
  type: "viz";
  vizType: string;
}
type Segment = TextSegment | VizSegment;

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const regex = /\[VISUALIZE:([a-z_]+)\]/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the marker
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      segments.push({ type: "text", content: before });
    }
    segments.push({ type: "viz", vizType: match[1].toLowerCase() });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last marker
  const after = text.slice(lastIndex).trim();
  if (after) {
    segments.push({ type: "text", content: after });
  }

  return segments;
}

/** Split markdown into sections by ## headings, with fallback to --- */
function splitIntoSteps(content: string): { title: string; body: string }[] {
  // Try splitting by ## headings
  const headingParts = content.split(/\n(?=## )/);
  if (headingParts.length >= 2) {
    const steps: { title: string; body: string }[] = [];
    let preamble = "";

    for (const part of headingParts) {
      const lines = part.trim().split("\n");
      const firstLine = lines[0];
      if (firstLine.startsWith("## ")) {
        const body = lines.slice(1).join("\n").trim();
        // Prepend the preamble (if any) into the first real section
        steps.push({
          title: stripMarkers(firstLine.replace(/^## /, "").trim()),
          body: preamble ? `${preamble}\n\n${body}` : body,
        });
        preamble = ""; // only prepend to first section
      } else {
        // Preamble before first heading — save to merge into first real step
        preamble = part.trim();
      }
    }
    if (steps.length > 0) return steps;
  }

  // Fallback: split by ---
  const hrParts = content.split(/\n---+\n/);
  if (hrParts.length >= 2) {
    return hrParts.map((part, i) => ({
      title: `Part ${i + 1}`,
      body: part.trim(),
    }));
  }

  // Single section
  return [{ title: "Overview", body: content.trim() }];
}

/** Split a section body into renderable blocks by double newlines, preserving code fences */
function splitIntoBlocks(body: string): string[] {
  const blocks: string[] = [];
  let current = "";
  let inCodeFence = false;

  for (const line of body.split("\n")) {
    if (line.trim().startsWith("```")) {
      inCodeFence = !inCodeFence;
      current += line + "\n";
      if (!inCodeFence) {
        blocks.push(current.trim());
        current = "";
      }
      continue;
    }

    if (inCodeFence) {
      current += line + "\n";
      continue;
    }

    if (line.trim() === "" && current.trim()) {
      blocks.push(current.trim());
      current = "";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) blocks.push(current.trim());
  return blocks.filter(Boolean);
}

/** Custom ReactMarkdown components with concept highlighting */
const highlightComponents = {
  strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
    <strong className="concept-highlight" {...props}>
      {children}
    </strong>
  ),
  code: ({
    children,
    className,
    ...props
  }: React.ComponentProps<"code"> & { className?: string }) => {
    if (!className) {
      return (
        <code className="code-highlight" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

// Animation variants
const stepVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? 40 : -40,
  }),
  center: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? -20 : 20,
  }),
};

const blockContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const blockItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

/** Render a block that may contain [VISUALIZE:type] markers inline */
function RenderBlock({ block, blockKey }: { block: string; blockKey: string }) {
  const segments = parseSegments(block);

  // No markers — render as plain markdown
  if (segments.length === 1 && segments[0].type === "text") {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={highlightComponents}
      >
        {processLatexContent(segments[0].content)}
      </ReactMarkdown>
    );
  }

  // Mixed content — render text and visualizers inline
  return (
    <div className="space-y-2">
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return (
            <ReactMarkdown
              key={`${blockKey}-text-${i}`}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={highlightComponents}
            >
              {processLatexContent(seg.content)}
            </ReactMarkdown>
          );
        }
        return <ConceptVisualizer key={`${blockKey}-viz-${i}`} type={seg.vizType} />;
      })}
    </div>
  );
}

export default function StepByStepViewer({
  content,
  onDone,
  topicTitle,
}: StepByStepViewerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const steps = useMemo(() => splitIntoSteps(content), [content]);
  const totalSteps = steps.length;

  function goNext() {
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    }
  }

  function goBack() {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }

  function handleDone() {
    onDone();
  }

  if (showAll) {
    const allBlocks = splitIntoBlocks(content);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            Full content view
          </span>
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            Back to steps
          </button>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:my-2 space-y-2">
          {allBlocks.map((block, i) => (
            <div key={`all-${i}`}>
              <RenderBlock block={block} blockKey={`all-${i}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <button
            onClick={handleDone}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const step = steps[currentStep];
  const blocks = splitIntoBlocks(step.body);
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="space-y-4">
      {/* Progress dots + step counter */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > currentStep ? 1 : -1);
                setCurrentStep(i);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "bg-blue-500 scale-125"
                  : i < currentStep
                  ? "bg-blue-300 dark:bg-blue-700"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] text-slate-400 font-medium">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <button
          onClick={() => setShowAll(true)}
          className="ml-auto text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
        >
          Show all
        </button>
      </div>

      {/* Step content with animated transition */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {/* Step title */}
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
              {currentStep + 1}
            </span>
            {step.title}
          </h3>

          {/* Staggered block reveal with inline visualizers */}
          <motion.div
            className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:my-2 space-y-2"
            variants={blockContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {blocks.map((block, i) => (
              <motion.div
                key={`${currentStep}-${i}`}
                variants={blockItemVariants}
              >
                <RenderBlock block={block} blockKey={`${currentStep}-${i}`} />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={goBack}
          disabled={currentStep === 0}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>

        <div className="flex gap-2">
          {isLastStep ? (
            <button
              onClick={handleDone}
              className="px-4 py-1.5 text-xs rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={goNext}
              className="px-4 py-1.5 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
