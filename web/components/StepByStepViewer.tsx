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

type AlgoType = "bubble" | "selection" | "insertion";

/** Detect ALL algorithm references in text for auto-visualization */
function detectAlgorithms(text: string): AlgoType[] {
  const lower = text.toLowerCase();
  const found: AlgoType[] = [];
  if (lower.includes("bubble sort")) found.push("bubble");
  if (lower.includes("selection sort")) found.push("selection");
  if (lower.includes("insertion sort")) found.push("insertion");
  return found;
}

/** Detect the first algorithm reference in text */
function detectAlgorithm(text: string): AlgoType | null {
  const algos = detectAlgorithms(text);
  return algos.length > 0 ? algos[0] : null;
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

/**
 * Given blocks of text, find which algorithms are mentioned and where.
 * Returns an array of { blockIndex, algorithm } for placing visualizers.
 * Each algorithm only gets one visualizer (at the LAST block that mentions it).
 */
function findAlgoInsertionPoints(
  blocks: string[]
): { afterBlockIndex: number; algorithm: AlgoType }[] {
  const algoLastBlock = new Map<AlgoType, number>();

  blocks.forEach((block, i) => {
    const algos = detectAlgorithms(block);
    for (const algo of algos) {
      algoLastBlock.set(algo, i);
    }
  });

  // Sort by block index so visualizers appear in document order
  const points = Array.from(algoLastBlock.entries())
    .map(([algorithm, afterBlockIndex]) => ({ afterBlockIndex, algorithm }))
    .sort((a, b) => a.afterBlockIndex - b.afterBlockIndex);

  return points;
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
    // In "show all" mode, render all blocks with inline visualizers
    const allBlocks = splitIntoBlocks(content);
    const insertionPoints = findAlgoInsertionPoints(allBlocks);

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
          {allBlocks.map((block, i) => {
            const algoPoint = insertionPoints.find(
              (p) => p.afterBlockIndex === i
            );
            return (
              <div key={`all-${i}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={highlightComponents}
                >
                  {processLatexContent(block)}
                </ReactMarkdown>
                {algoPoint && (
                  <AlgorithmVisualizer algorithm={algoPoint.algorithm} />
                )}
              </div>
            );
          })}
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

  // Find algorithm insertion points for THIS step's blocks
  const stepInsertionPoints = findAlgoInsertionPoints(blocks);

  // Also check if the step title mentions an algorithm not found in any block
  const titleAlgo = detectAlgorithm(step.title);
  const blockAlgos = new Set(stepInsertionPoints.map((p) => p.algorithm));
  const showTitleAlgo = titleAlgo && !blockAlgos.has(titleAlgo);

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

          {/* Staggered block reveal with inline algorithm visualizers */}
          <motion.div
            className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:my-2 space-y-2"
            variants={blockContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {blocks.map((block, i) => {
              const algoPoint = stepInsertionPoints.find(
                (p) => p.afterBlockIndex === i
              );
              return (
                <motion.div
                  key={`${currentStep}-${i}`}
                  variants={blockItemVariants}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={highlightComponents}
                  >
                    {processLatexContent(block)}
                  </ReactMarkdown>
                  {/* Inline visualizer — appears right after the block that explains this algorithm */}
                  {algoPoint && (
                    <AlgorithmVisualizer algorithm={algoPoint.algorithm} />
                  )}
                </motion.div>
              );
            })}

            {/* Fallback: if step title mentions an algo but no block does, show at end */}
            {showTitleAlgo && (
              <motion.div variants={blockItemVariants}>
                <AlgorithmVisualizer algorithm={titleAlgo} />
              </motion.div>
            )}
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
