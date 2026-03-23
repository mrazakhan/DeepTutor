"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AlgoStep {
  array: number[];
  highlights: number[]; // indices being compared
  swapped: number[]; // indices that just swapped
  sorted: number[]; // indices confirmed sorted
  label: string;
}

interface AlgorithmVisualizerProps {
  algorithm: "bubble" | "selection" | "insertion" | "merge";
  initialArray?: number[];
}

function generateSteps(algorithm: string, input: number[]): AlgoStep[] {
  const steps: AlgoStep[] = [];
  const arr = [...input];

  steps.push({
    array: [...arr],
    highlights: [],
    swapped: [],
    sorted: [],
    label: "Initial array",
  });

  if (algorithm === "bubble") {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        steps.push({
          array: [...arr],
          highlights: [j, j + 1],
          swapped: [],
          sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
          label: `Compare arr[${j}]=${arr[j]} and arr[${j + 1}]=${arr[j + 1]}`,
        });
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          steps.push({
            array: [...arr],
            highlights: [],
            swapped: [j, j + 1],
            sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
            label: `Swap! ${arr[j + 1]} > ${arr[j]} → swapped`,
          });
        }
      }
    }
  } else if (algorithm === "selection") {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        steps.push({
          array: [...arr],
          highlights: [minIdx, j],
          swapped: [],
          sorted: Array.from({ length: i }, (_, k) => k),
          label: `Find min: comparing arr[${minIdx}]=${arr[minIdx]} with arr[${j}]=${arr[j]}`,
        });
        if (arr[j] < arr[minIdx]) minIdx = j;
      }
      if (minIdx !== i) {
        [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
        steps.push({
          array: [...arr],
          highlights: [],
          swapped: [i, minIdx],
          sorted: Array.from({ length: i + 1 }, (_, k) => k),
          label: `Swap arr[${i}] and arr[${minIdx}] — min placed at position ${i}`,
        });
      }
    }
  } else if (algorithm === "insertion") {
    const n = arr.length;
    for (let i = 1; i < n; i++) {
      const key = arr[i];
      let j = i - 1;
      steps.push({
        array: [...arr],
        highlights: [i],
        swapped: [],
        sorted: Array.from({ length: i }, (_, k) => k),
        label: `Insert key=${key} into sorted portion`,
      });
      while (j >= 0 && arr[j] > key) {
        arr[j + 1] = arr[j];
        steps.push({
          array: [...arr],
          highlights: [j, j + 1],
          swapped: [j + 1],
          sorted: [],
          label: `Shift arr[${j}]=${arr[j]} right`,
        });
        j--;
      }
      arr[j + 1] = key;
      steps.push({
        array: [...arr],
        highlights: [],
        swapped: [j + 1],
        sorted: Array.from({ length: i + 1 }, (_, k) => k),
        label: `Place key=${key} at position ${j + 1}`,
      });
    }
  }

  // Final sorted state
  steps.push({
    array: [...arr],
    highlights: [],
    swapped: [],
    sorted: arr.map((_, i) => i),
    label: "Sorted!",
  });

  return steps;
}

const ALGO_NAMES: Record<string, string> = {
  bubble: "Bubble Sort",
  selection: "Selection Sort",
  insertion: "Insertion Sort",
  merge: "Merge Sort",
};

export default function AlgorithmVisualizer({
  algorithm,
  initialArray,
}: AlgorithmVisualizerProps) {
  const defaultArr = initialArray || [38, 27, 43, 3, 9, 82, 10];
  const [steps, setSteps] = useState<AlgoStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSteps(generateSteps(algorithm, defaultArr));
    setStepIdx(0);
    setPlaying(false);
  }, [algorithm]);

  const maxVal = Math.max(...defaultArr, 1);
  const current = steps[stepIdx] || steps[0];

  const play = useCallback(() => {
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (playing && stepIdx < steps.length - 1) {
      intervalRef.current = setTimeout(() => {
        setStepIdx((i) => i + 1);
      }, 600);
    } else if (stepIdx >= steps.length - 1) {
      setPlaying(false);
    }
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [playing, stepIdx, steps.length]);

  const reset = () => {
    setStepIdx(0);
    setPlaying(false);
  };

  if (!current) return null;

  return (
    <div className="my-4 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
          {ALGO_NAMES[algorithm] || algorithm} Visualization
        </span>
        <span className="text-[10px] text-slate-400">
          Step {stepIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Array bars */}
      <div className="flex items-end gap-1 h-32 mb-3 px-2">
        {current.array.map((val, i) => {
          const isHighlighted = current.highlights.includes(i);
          const isSwapped = current.swapped.includes(i);
          const isSorted = current.sorted.includes(i);
          const heightPct = (val / maxVal) * 100;

          let bg = "bg-slate-300 dark:bg-slate-600";
          if (isSorted) bg = "bg-green-400 dark:bg-green-600";
          if (isHighlighted) bg = "bg-amber-400 dark:bg-amber-500";
          if (isSwapped) bg = "bg-red-400 dark:bg-red-500";

          return (
            <motion.div
              key={i}
              className="flex flex-col items-center flex-1"
              layout
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <span className="text-[9px] font-mono text-slate-500 mb-0.5">
                {val}
              </span>
              <motion.div
                className={`w-full rounded-t-sm ${bg} transition-colors duration-200`}
                style={{ height: `${Math.max(heightPct, 8)}%` }}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Step label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stepIdx}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-xs text-slate-600 dark:text-slate-400 text-center mb-3 font-mono"
        >
          {current.label}
        </motion.p>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={reset}
          className="px-2.5 py-1 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="px-2.5 py-1 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={playing ? pause : play}
          className="px-3 py-1 text-[10px] rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
          disabled={stepIdx >= steps.length - 1}
          className="px-2.5 py-1 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 justify-center">
        <span className="flex items-center gap-1 text-[9px] text-slate-400">
          <span className="w-2 h-2 rounded-sm bg-amber-400" /> Comparing
        </span>
        <span className="flex items-center gap-1 text-[9px] text-slate-400">
          <span className="w-2 h-2 rounded-sm bg-red-400" /> Swapping
        </span>
        <span className="flex items-center gap-1 text-[9px] text-slate-400">
          <span className="w-2 h-2 rounded-sm bg-green-400" /> Sorted
        </span>
      </div>
    </div>
  );
}
