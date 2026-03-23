"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AlgoStep {
  array: number[];
  highlights: number[]; // indices being compared
  swapped: number[]; // indices that just swapped
  sorted: number[]; // indices confirmed sorted
  label: string;
  pointers?: { index: number; label: string }[]; // e.g., i, j, min pointers
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
    label: "Start: unsorted array",
    pointers: [],
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
          label: `Compare ${arr[j]} and ${arr[j + 1]}`,
          pointers: [
            { index: j, label: "j" },
            { index: j + 1, label: "j+1" },
          ],
        });
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          steps.push({
            array: [...arr],
            highlights: [],
            swapped: [j, j + 1],
            sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
            label: `Swap! ${arr[j + 1]} > ${arr[j]}`,
            pointers: [
              { index: j, label: "j" },
              { index: j + 1, label: "j+1" },
            ],
          });
        } else {
          steps.push({
            array: [...arr],
            highlights: [],
            swapped: [],
            sorted: Array.from({ length: i }, (_, k) => n - 1 - k),
            label: `No swap needed (${arr[j]} <= ${arr[j + 1]})`,
            pointers: [],
          });
        }
      }
      // Mark end of pass
      const sortedSoFar = Array.from({ length: i + 1 }, (_, k) => n - 1 - k);
      steps.push({
        array: [...arr],
        highlights: [],
        swapped: [],
        sorted: sortedSoFar,
        label: `Pass ${i + 1} complete — ${arr[n - 1 - i]} is in place`,
        pointers: [],
      });
    }
  } else if (algorithm === "selection") {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      steps.push({
        array: [...arr],
        highlights: [i],
        swapped: [],
        sorted: Array.from({ length: i }, (_, k) => k),
        label: `Pass ${i + 1}: find minimum starting from index ${i}`,
        pointers: [{ index: i, label: "min" }],
      });
      for (let j = i + 1; j < n; j++) {
        steps.push({
          array: [...arr],
          highlights: [minIdx, j],
          swapped: [],
          sorted: Array.from({ length: i }, (_, k) => k),
          label: `Compare min(${arr[minIdx]}) with ${arr[j]}${arr[j] < arr[minIdx] ? " — new min!" : ""}`,
          pointers: [
            { index: minIdx, label: "min" },
            { index: j, label: "j" },
          ],
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
          label: `Swap ${arr[minIdx]} and ${arr[i]} — position ${i} is set`,
          pointers: [],
        });
      } else {
        steps.push({
          array: [...arr],
          highlights: [],
          swapped: [],
          sorted: Array.from({ length: i + 1 }, (_, k) => k),
          label: `${arr[i]} is already the minimum — no swap`,
          pointers: [],
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
        label: `Pick ${key} — insert into sorted portion [0..${i - 1}]`,
        pointers: [{ index: i, label: "key" }],
      });
      while (j >= 0 && arr[j] > key) {
        arr[j + 1] = arr[j];
        steps.push({
          array: [...arr],
          highlights: [j, j + 1],
          swapped: [j + 1],
          sorted: [],
          label: `Shift ${arr[j]} right (${arr[j]} > ${key})`,
          pointers: [{ index: j + 1, label: "shift" }],
        });
        j--;
      }
      arr[j + 1] = key;
      steps.push({
        array: [...arr],
        highlights: [],
        swapped: [j + 1],
        sorted: Array.from({ length: i + 1 }, (_, k) => k),
        label: `Insert ${key} at position ${j + 1}`,
        pointers: [{ index: j + 1, label: "placed" }],
      });
    }
  }

  // Final sorted state
  steps.push({
    array: [...arr],
    highlights: [],
    swapped: [],
    sorted: arr.map((_, i) => i),
    label: "Done! Array is sorted.",
    pointers: [],
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
  const [speed, setSpeed] = useState(800);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSteps(generateSteps(algorithm, defaultArr));
    setStepIdx(0);
    setPlaying(false);
  }, [algorithm]);

  const current = steps[stepIdx] || steps[0];

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (playing && stepIdx < steps.length - 1) {
      intervalRef.current = setTimeout(() => {
        setStepIdx((i) => i + 1);
      }, speed);
    } else if (stepIdx >= steps.length - 1) {
      setPlaying(false);
    }
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [playing, stepIdx, steps.length, speed]);

  const reset = () => {
    setStepIdx(0);
    setPlaying(false);
  };

  if (!current) return null;

  const isFinalStep = stepIdx === steps.length - 1;

  return (
    <div className="my-4 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
          {ALGO_NAMES[algorithm] || algorithm}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          Step {stepIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Index labels */}
      <div className="flex justify-center gap-1.5 mb-1 px-1">
        {current.array.map((_, i) => (
          <div
            key={`idx-${i}`}
            className="w-10 sm:w-12 text-center text-[9px] text-slate-400 font-mono"
          >
            [{i}]
          </div>
        ))}
      </div>

      {/* Array cards */}
      <div className="flex justify-center gap-1.5 mb-2 px-1">
        {current.array.map((val, i) => {
          const isHighlighted = current.highlights.includes(i);
          const isSwapped = current.swapped.includes(i);
          const isSorted = current.sorted.includes(i);

          let borderColor = "border-slate-200 dark:border-slate-700";
          let bgColor = "bg-white dark:bg-slate-800";
          let textColor = "text-slate-700 dark:text-slate-300";
          let shadow = "";

          if (isFinalStep || isSorted) {
            borderColor = "border-emerald-400 dark:border-emerald-600";
            bgColor = "bg-emerald-50 dark:bg-emerald-900/30";
            textColor = "text-emerald-700 dark:text-emerald-300";
          }
          if (isHighlighted) {
            borderColor = "border-amber-400 dark:border-amber-500";
            bgColor = "bg-amber-50 dark:bg-amber-900/30";
            textColor = "text-amber-700 dark:text-amber-300";
            shadow = "shadow-md shadow-amber-200/50 dark:shadow-amber-800/30";
          }
          if (isSwapped) {
            borderColor = "border-rose-400 dark:border-rose-500";
            bgColor = "bg-rose-50 dark:bg-rose-900/30";
            textColor = "text-rose-700 dark:text-rose-300";
            shadow = "shadow-md shadow-rose-200/50 dark:shadow-rose-800/30";
          }

          return (
            <motion.div
              key={`card-${i}`}
              className={`w-10 sm:w-12 h-10 sm:h-12 rounded-lg border-2 ${borderColor} ${bgColor} ${shadow} flex items-center justify-center transition-colors duration-300`}
              animate={{
                scale: isHighlighted || isSwapped ? 1.1 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <span
                className={`text-sm sm:text-base font-bold font-mono ${textColor} transition-colors duration-300`}
              >
                {val}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Pointer labels (i, j, min, key) */}
      <div className="flex justify-center gap-1.5 mb-3 px-1 h-5">
        {current.array.map((_, i) => {
          const pointer = current.pointers?.find((p) => p.index === i);
          return (
            <div
              key={`ptr-${i}`}
              className="w-10 sm:w-12 text-center"
            >
              {pointer && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400"
                >
                  {pointer.label}
                </motion.span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step description */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`text-center mb-4 px-3 py-2 rounded-lg ${
            isFinalStep
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              : "bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
          }`}
        >
          <p
            className={`text-xs font-medium ${
              isFinalStep
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {current.label}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={reset}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <button
          onClick={playing ? pause : play}
          className={`px-4 py-1.5 text-[11px] rounded-md font-semibold transition-colors ${
            playing
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
          disabled={stepIdx >= steps.length - 1}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>

      {/* Speed control */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-[10px] text-slate-400">Speed:</span>
        {[
          { label: "Slow", val: 1200 },
          { label: "Normal", val: 800 },
          { label: "Fast", val: 400 },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setSpeed(s.val)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              speed === s.val
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isFinalStep ? "bg-emerald-500" : "bg-blue-500"}`}
          animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="w-3 h-3 rounded border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/30" />
          Comparing
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="w-3 h-3 rounded border-2 border-rose-400 bg-rose-50 dark:bg-rose-900/30" />
          Swapped
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="w-3 h-3 rounded border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" />
          Sorted
        </span>
      </div>
    </div>
  );
}
