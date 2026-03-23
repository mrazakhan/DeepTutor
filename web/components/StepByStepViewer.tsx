"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import dynamic from "next/dynamic";
import { processLatexContent } from "@/lib/latex";

const AlgorithmVisualizer = dynamic(() => import("./AlgorithmVisualizer"), {
  ssr: false,
});

interface StepByStepViewerProps {
  content: string;
  onDone: () => void;
  topicTitle?: string;
}

/** Detect algorithm references in text for auto-visualization */
function detectAlgorithm(
  text: string
): "bubble" | "selection" | "insertion" | null {
  const lower = text.toLowerCase();
  if (lower.includes("bubble sort")) return "bubble";
  if (lower.includes("selection sort")) return "selection";
  if (lower.includes("insertion sort")) return "insertion";
  return null;
}

/** Split markdown into sections by ## headings, with fallback to --- */
function splitIntoSteps(content: string): { title: string; body: string }[] {
  // Try splitting by ## headings
  const headingParts = content.split(/\n(?=## )/);
  if (headingParts.length >= 2) {
    return headingParts.map((part) => {
      const lines = part.trim().split("\n");
      const firstLine = lines[0];
      if (firstLine.startsWith("## ")) {
        return {
          title: firstLine.replace(/^## /, "").trim(),
          body: lines.slice(1).join("\n").trim(),
        };
      }
      // Preamble before first heading
      return { title: "Introduction", body: part.trim() };
    });
  }

  // Fallback: split by ---
  const hrParts = content.split(/\n---+\n/);
  if (hrParts.length >= 2) {
    return hrParts.map((part, i) => ({
      title: `Part ${i + 1}`,
      body: part.trim(),
    }));
  }

  // Single section — still show step-by-step with blocks
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
        // End of code block — push as one block
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
    // Only highlight inline code (no language class = inline)
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

  // Detect if any step mentions a sorting algorithm
  const detectedAlgo = useMemo(() => {
    const fullText = content + " " + (topicTitle || "");
    return detectAlgorithm(fullText);
  }, [content, topicTitle]);

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
            ← Back to steps
          </button>
        </div>
        {detectedAlgo && <AlgorithmVisualizer algorithm={detectedAlgo} />}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:my-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={highlightComponents}
          >
            {processLatexContent(content)}
          </ReactMarkdown>
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
  // Show algorithm visualizer on the step that discusses sorting
  const stepAlgo = detectAlgorithm(step.title + " " + step.body);

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

      {/* Step title */}
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
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">
              {currentStep + 1}
            </span>
            {step.title}
          </h3>

          {/* Algorithm visualizer if detected */}
          {stepAlgo && <AlgorithmVisualizer algorithm={stepAlgo} />}
          {/* Also show on first step if algorithm detected globally */}
          {!stepAlgo && currentStep === 0 && detectedAlgo && (
            <AlgorithmVisualizer algorithm={detectedAlgo} />
          )}

          {/* Staggered block reveal */}
          <motion.div
            className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:my-2 space-y-2"
            variants={blockContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {blocks.map((block, i) => (
              <motion.div key={`${currentStep}-${i}`} variants={blockItemVariants}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={highlightComponents}
                >
                  {processLatexContent(block)}
                </ReactMarkdown>
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
          ← Back
        </button>

        <div className="flex gap-2">
          {isLastStep ? (
            <button
              onClick={handleDone}
              className="px-4 py-1.5 text-xs rounded-lg bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
            >
              Done ✓
            </button>
          ) : (
            <button
              onClick={goNext}
              className="px-4 py-1.5 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
