"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Generic step-based visualizer engine ────────────────────────────────────

interface VisStep {
  elements: VisElement[];
  label: string;
  auxLabel?: string; // secondary info (e.g. "Sorted portion")
}

interface VisElement {
  value: string | number;
  state: "default" | "active" | "comparing" | "swapping" | "sorted" | "found" | "visited" | "current" | "pushed" | "popped" | "left" | "right" | "merged";
  label?: string; // pointer label below (e.g. "i", "j", "mid")
  row?: number; // for 2D layouts (tree levels, merge sort splits)
  col?: number;
  group?: number; // grouping for merge sort subarrays
}

// State → visual style mapping
const STATE_STYLES: Record<VisElement["state"], { border: string; bg: string; text: string }> = {
  default:   { border: "border-slate-200 dark:border-slate-700", bg: "bg-white dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  active:    { border: "border-blue-400 dark:border-blue-500", bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  comparing: { border: "border-amber-400 dark:border-amber-500", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  swapping:  { border: "border-rose-400 dark:border-rose-500", bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300" },
  sorted:    { border: "border-emerald-400 dark:border-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  found:     { border: "border-green-500 dark:border-green-400", bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300" },
  visited:   { border: "border-purple-400 dark:border-purple-500", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  current:   { border: "border-blue-500 dark:border-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  pushed:    { border: "border-indigo-400 dark:border-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300" },
  popped:    { border: "border-orange-400 dark:border-orange-500", bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  left:      { border: "border-sky-400 dark:border-sky-500", bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300" },
  right:     { border: "border-violet-400 dark:border-violet-500", bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300" },
  merged:    { border: "border-teal-400 dark:border-teal-500", bg: "bg-teal-50 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300" },
};

// ─── Step generators for each concept ────────────────────────────────────────

function genBubbleSort(input: number[]): VisStep[] {
  const steps: VisStep[] = [];
  const arr = [...input];
  const n = arr.length;

  steps.push({
    elements: arr.map((v, i) => ({ value: v, state: "default" })),
    label: "Start: unsorted array",
  });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k === j || k === j + 1 ? "comparing" : k >= n - i ? "sorted" : "default",
          label: k === j ? "j" : k === j + 1 ? "j+1" : undefined,
        })),
        label: `Compare ${arr[j]} and ${arr[j + 1]}`,
      });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        steps.push({
          elements: arr.map((v, k) => ({
            value: v,
            state: k === j || k === j + 1 ? "swapping" : k >= n - i ? "sorted" : "default",
            label: k === j ? "j" : k === j + 1 ? "j+1" : undefined,
          })),
          label: `Swap! ${arr[j + 1]} > ${arr[j]} → swapped`,
        });
      }
    }
    steps.push({
      elements: arr.map((v, k) => ({
        value: v,
        state: k >= n - i - 1 ? "sorted" : "default",
      })),
      label: `Pass ${i + 1} complete — ${arr[n - 1 - i]} is in its final position`,
    });
  }

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "sorted" as const })),
    label: "Done! Array is sorted.",
  });
  return steps;
}

function genSelectionSort(input: number[]): VisStep[] {
  const steps: VisStep[] = [];
  const arr = [...input];
  const n = arr.length;

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "default" as const })),
    label: "Start: unsorted array",
  });

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    steps.push({
      elements: arr.map((v, k) => ({
        value: v,
        state: k < i ? "sorted" : k === i ? "active" : "default",
        label: k === i ? "min" : undefined,
      })),
      label: `Pass ${i + 1}: find the minimum from index ${i} onward`,
    });
    for (let j = i + 1; j < n; j++) {
      if (arr[j] < arr[minIdx]) minIdx = j;
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k < i ? "sorted" : k === minIdx ? "active" : k === j ? "comparing" : "default",
          label: k === minIdx ? "min" : k === j ? "j" : undefined,
        })),
        label: arr[j] <= arr[minIdx] && j === minIdx ? `New minimum found: ${arr[minIdx]} at index ${minIdx}` : `Compare: ${arr[j]} ${arr[j] < arr[minIdx - (j === minIdx ? 0 : 1)] ? "<" : "≥"} min(${arr[minIdx]})`,
      });
    }
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k <= i ? "sorted" : k === minIdx ? "swapping" : "default",
        })),
        label: `Swap index ${i} and ${minIdx} — ${arr[i]} is now in place`,
      });
    } else {
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k <= i ? "sorted" : "default",
        })),
        label: `${arr[i]} is already the minimum — no swap needed`,
      });
    }
  }

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "sorted" as const })),
    label: "Done! Array is sorted.",
  });
  return steps;
}

function genInsertionSort(input: number[]): VisStep[] {
  const steps: VisStep[] = [];
  const arr = [...input];
  const n = arr.length;

  steps.push({
    elements: arr.map((v, i) => ({ value: v, state: i === 0 ? "sorted" : "default" as VisElement["state"] })),
    label: "Start: first element is trivially sorted",
  });

  for (let i = 1; i < n; i++) {
    const key = arr[i];
    steps.push({
      elements: arr.map((v, k) => ({
        value: v,
        state: k < i ? "sorted" : k === i ? "active" : "default",
        label: k === i ? `key=${key}` : undefined,
      })),
      label: `Pick ${key} — insert into sorted portion [0..${i - 1}]`,
    });
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k === j + 1 ? "swapping" : k <= j && k < i ? "sorted" : "default",
          label: k === j + 1 ? "shift→" : undefined,
        })),
        label: `Shift ${arr[j + 1]} right (${arr[j + 1]} > ${key})`,
      });
      j--;
    }
    arr[j + 1] = key;
    steps.push({
      elements: arr.map((v, k) => ({
        value: v,
        state: k <= i ? "sorted" : "default",
        label: k === j + 1 ? "placed" : undefined,
      })),
      label: `Insert ${key} at position ${j + 1}`,
    });
  }

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "sorted" as const })),
    label: "Done! Array is sorted.",
  });
  return steps;
}

function genMergeSort(input: number[]): VisStep[] {
  const steps: VisStep[] = [];
  const arr = [...input];

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "default" as const })),
    label: "Start: unsorted array",
  });

  function mergeSort(a: number[], left: number, right: number) {
    if (left >= right) return;
    const mid = Math.floor((left + right) / 2);

    steps.push({
      elements: arr.map((v, k) => ({
        value: v,
        state: k >= left && k <= mid ? "left" : k > mid && k <= right ? "right" : "default",
      })),
      label: `Split [${left}..${right}] into [${left}..${mid}] and [${mid + 1}..${right}]`,
    });

    mergeSort(a, left, mid);
    mergeSort(a, mid + 1, right);

    // Merge
    const leftArr = a.slice(left, mid + 1);
    const rightArr = a.slice(mid + 1, right + 1);
    let i = 0, j = 0, k = left;

    while (i < leftArr.length && j < rightArr.length) {
      steps.push({
        elements: arr.map((v, idx) => ({
          value: v,
          state: idx === left + i ? "left" : idx === mid + 1 + j ? "right" : idx >= left && idx <= right ? "comparing" : idx < left ? "sorted" : "default",
        })),
        label: `Merge: compare ${leftArr[i]} and ${rightArr[j]}`,
      });
      if (leftArr[i] <= rightArr[j]) {
        a[k] = leftArr[i];
        arr[k] = leftArr[i];
        i++;
      } else {
        a[k] = rightArr[j];
        arr[k] = rightArr[j];
        j++;
      }
      k++;
      steps.push({
        elements: arr.map((v, idx) => ({
          value: v,
          state: idx < k && idx >= left ? "merged" : idx >= left && idx <= right ? "comparing" : "default",
        })),
        label: `Placed ${arr[k - 1]} at position ${k - 1}`,
      });
    }

    while (i < leftArr.length) {
      a[k] = leftArr[i];
      arr[k] = leftArr[i];
      i++; k++;
    }
    while (j < rightArr.length) {
      a[k] = rightArr[j];
      arr[k] = rightArr[j];
      j++; k++;
    }

    steps.push({
      elements: arr.map((v, idx) => ({
        value: v,
        state: idx >= left && idx <= right ? "merged" : "default",
      })),
      label: `Merged [${left}..${right}]: [${arr.slice(left, right + 1).join(", ")}]`,
    });
  }

  mergeSort(arr, 0, arr.length - 1);

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "sorted" as const })),
    label: "Done! Array is sorted.",
  });
  return steps;
}

function genBinarySearch(input: number[]): VisStep[] {
  const steps: VisStep[] = [];
  const arr = [...input].sort((a, b) => a - b);
  // Pick a target that exists
  const target = arr[Math.floor(arr.length / 2) + 1] ?? arr[Math.floor(arr.length / 2)];

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "default" as const })),
    label: `Sorted array. Target: ${target}`,
  });

  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    steps.push({
      elements: arr.map((v, k) => ({
        value: v,
        state: k === mid ? "active" : k >= lo && k <= hi ? "comparing" : "visited",
        label: k === lo ? "lo" : k === hi ? "hi" : k === mid ? "mid" : undefined,
      })),
      label: `Check mid=${mid}: arr[${mid}]=${arr[mid]} vs target=${target}`,
    });

    if (arr[mid] === target) {
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k === mid ? "found" : "default",
          label: k === mid ? "found!" : undefined,
        })),
        label: `Found ${target} at index ${mid}!`,
      });
      return steps;
    } else if (arr[mid] < target) {
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k <= mid ? "visited" : k > mid && k <= hi ? "comparing" : "visited",
        })),
        label: `${arr[mid]} < ${target} → search right half [${mid + 1}..${hi}]`,
      });
      lo = mid + 1;
    } else {
      steps.push({
        elements: arr.map((v, k) => ({
          value: v,
          state: k >= mid ? "visited" : k >= lo && k < mid ? "comparing" : "visited",
        })),
        label: `${arr[mid]} > ${target} → search left half [${lo}..${mid - 1}]`,
      });
      hi = mid - 1;
    }
  }

  steps.push({
    elements: arr.map((v) => ({ value: v, state: "visited" as const })),
    label: `${target} not found in array.`,
  });
  return steps;
}

function genStack(): VisStep[] {
  const steps: VisStep[] = [];
  const stack: number[] = [];
  const ops = [
    { op: "push", val: 10 },
    { op: "push", val: 20 },
    { op: "push", val: 30 },
    { op: "peek" },
    { op: "pop" },
    { op: "push", val: 40 },
    { op: "pop" },
    { op: "pop" },
  ];

  steps.push({ elements: [], label: "Empty stack (LIFO — Last In, First Out)" });

  for (const o of ops) {
    if (o.op === "push" && o.val !== undefined) {
      stack.push(o.val);
      steps.push({
        elements: stack.map((v, i) => ({
          value: v,
          state: i === stack.length - 1 ? "pushed" : "default",
          label: i === stack.length - 1 ? "top" : undefined,
        })),
        label: `push(${o.val}) → stack: [${stack.join(", ")}]`,
      });
    } else if (o.op === "pop") {
      const popped = stack.pop();
      steps.push({
        elements: stack.length > 0
          ? stack.map((v, i) => ({
              value: v,
              state: i === stack.length - 1 ? "active" : "default",
              label: i === stack.length - 1 ? "top" : undefined,
            }))
          : [{ value: "∅", state: "default" as const }],
        label: `pop() → returned ${popped}. Stack: [${stack.join(", ") || "empty"}]`,
      });
    } else if (o.op === "peek") {
      steps.push({
        elements: stack.map((v, i) => ({
          value: v,
          state: i === stack.length - 1 ? "found" : "default",
          label: i === stack.length - 1 ? "peek" : undefined,
        })),
        label: `peek() → ${stack[stack.length - 1]} (top element, not removed)`,
      });
    }
  }
  return steps;
}

function genQueue(): VisStep[] {
  const steps: VisStep[] = [];
  const queue: number[] = [];
  const ops = [
    { op: "enqueue", val: 10 },
    { op: "enqueue", val: 20 },
    { op: "enqueue", val: 30 },
    { op: "peek" },
    { op: "dequeue" },
    { op: "enqueue", val: 40 },
    { op: "dequeue" },
    { op: "dequeue" },
  ];

  steps.push({ elements: [], label: "Empty queue (FIFO — First In, First Out)" });

  for (const o of ops) {
    if (o.op === "enqueue" && o.val !== undefined) {
      queue.push(o.val);
      steps.push({
        elements: queue.map((v, i) => ({
          value: v,
          state: i === queue.length - 1 ? "pushed" : i === 0 ? "active" : "default",
          label: i === 0 ? "front" : i === queue.length - 1 ? "rear" : undefined,
        })),
        label: `enqueue(${o.val}) → queue: [${queue.join(" → ")}]`,
      });
    } else if (o.op === "dequeue") {
      const removed = queue.shift();
      steps.push({
        elements: queue.length > 0
          ? queue.map((v, i) => ({
              value: v,
              state: i === 0 ? "active" : "default",
              label: i === 0 ? "front" : i === queue.length - 1 ? "rear" : undefined,
            }))
          : [{ value: "∅", state: "default" as const }],
        label: `dequeue() → returned ${removed}. Queue: [${queue.join(" → ") || "empty"}]`,
      });
    } else if (o.op === "peek") {
      steps.push({
        elements: queue.map((v, i) => ({
          value: v,
          state: i === 0 ? "found" : "default",
          label: i === 0 ? "front" : i === queue.length - 1 ? "rear" : undefined,
        })),
        label: `peek() → ${queue[0]} (front element, not removed)`,
      });
    }
  }
  return steps;
}

function genLinkedList(): VisStep[] {
  const steps: VisStep[] = [];
  const list: number[] = [];

  steps.push({ elements: [{ value: "null", state: "default" }], label: "Empty linked list: head → null" });

  // Add to front
  list.unshift(30);
  steps.push({
    elements: [...list.map((v, i) => ({ value: v, state: i === 0 ? "pushed" as const : "default" as const, label: i === 0 ? "head" : undefined })), { value: "null", state: "default" as const }],
    label: "addFirst(30): head → 30 → null",
  });

  list.unshift(20);
  steps.push({
    elements: [...list.map((v, i) => ({ value: v, state: i === 0 ? "pushed" as const : "default" as const, label: i === 0 ? "head" : undefined })), { value: "null", state: "default" as const }],
    label: "addFirst(20): head → 20 → 30 → null",
  });

  list.unshift(10);
  steps.push({
    elements: [...list.map((v, i) => ({ value: v, state: i === 0 ? "pushed" as const : "default" as const, label: i === 0 ? "head" : undefined })), { value: "null", state: "default" as const }],
    label: "addFirst(10): head → 10 → 20 → 30 → null",
  });

  // Traverse to find 20
  for (let i = 0; i < list.length; i++) {
    steps.push({
      elements: [...list.map((v, k) => ({ value: v, state: k === i ? "current" as const : k < i ? "visited" as const : "default" as const, label: k === i ? "curr" : k === 0 ? "head" : undefined })), { value: "null", state: "default" as const }],
      label: i < list.length && list[i] === 20 ? `Found 20 at node ${i}!` : `Traversing: checking node ${i} (value=${list[i]})`,
    });
    if (list[i] === 20) break;
  }

  // Remove middle node (20)
  list.splice(1, 1);
  steps.push({
    elements: [...list.map((v, i) => ({ value: v, state: "default" as const, label: i === 0 ? "head" : undefined })), { value: "null", state: "default" as const }],
    label: "remove(20): head → 10 → 30 → null (bypassed node 20)",
  });

  // Add to end
  list.push(40);
  steps.push({
    elements: [...list.map((v, i) => ({ value: v, state: i === list.length - 1 ? "pushed" as const : "default" as const, label: i === 0 ? "head" : undefined })), { value: "null", state: "default" as const }],
    label: "addLast(40): head → 10 → 30 → 40 → null",
  });

  return steps;
}

function genRecursion(): VisStep[] {
  const steps: VisStep[] = [];
  const n = 5;

  // Show factorial(5) call stack
  steps.push({
    elements: [{ value: `f(${n})`, state: "active" }],
    label: `Calculate factorial(${n}): ${n}! = ?`,
  });

  // Build up the call stack
  const stack: string[] = [];
  for (let i = n; i >= 0; i--) {
    stack.push(`f(${i})`);
    steps.push({
      elements: stack.map((v, k) => ({
        value: v,
        state: k === stack.length - 1 ? "pushed" : "default",
        label: k === stack.length - 1 ? "call" : undefined,
      })),
      label: i === 0
        ? `Base case: f(0) = 1`
        : `f(${i}) calls f(${i - 1}) — added to call stack`,
    });
  }

  // Unwind the stack
  let result = 1;
  for (let i = 1; i <= n; i++) {
    stack.pop();
    result *= i;
    steps.push({
      elements: stack.length > 0
        ? stack.map((v, k) => ({
            value: v,
            state: k === stack.length - 1 ? "active" : "default",
            label: k === stack.length - 1 ? `=${result}` : undefined,
          }))
        : [{ value: `${result}`, state: "found" as const, label: `${n}!` }],
      label: `f(${i}) returns ${i} × ${result / i} = ${result}`,
    });
  }

  return steps;
}

function genArrayList(): VisStep[] {
  const steps: VisStep[] = [];
  const list: number[] = [];

  steps.push({ elements: [{ value: "[ ]", state: "default" }], label: "Empty ArrayList: size = 0" });

  // add elements
  for (const val of [10, 20, 30, 40]) {
    list.push(val);
    steps.push({
      elements: list.map((v, i) => ({
        value: v,
        state: i === list.length - 1 ? "pushed" : "default",
        label: `[${i}]`,
      })),
      label: `add(${val}) → size = ${list.length}`,
    });
  }

  // get(2)
  steps.push({
    elements: list.map((v, i) => ({
      value: v,
      state: i === 2 ? "found" : "default",
      label: `[${i}]`,
    })),
    label: `get(2) → returns ${list[2]}`,
  });

  // set(1, 25)
  list[1] = 25;
  steps.push({
    elements: list.map((v, i) => ({
      value: v,
      state: i === 1 ? "swapping" : "default",
      label: `[${i}]`,
    })),
    label: `set(1, 25) → replaced 20 with 25`,
  });

  // add(2, 15) — insert at index 2
  list.splice(2, 0, 15);
  steps.push({
    elements: list.map((v, i) => ({
      value: v,
      state: i === 2 ? "pushed" : i > 2 ? "swapping" : "default",
      label: `[${i}]`,
    })),
    label: `add(2, 15) → inserted 15 at index 2, shifted elements right`,
  });

  // remove(1)
  const removed = list.splice(1, 1)[0];
  steps.push({
    elements: list.map((v, i) => ({
      value: v,
      state: i >= 1 ? "swapping" : "default",
      label: `[${i}]`,
    })),
    label: `remove(1) → removed ${removed}, shifted elements left. Size = ${list.length}`,
  });

  return steps;
}

function genTreeTraversal(): VisStep[] {
  const steps: VisStep[] = [];
  //       4
  //      / \
  //     2   6
  //    / \ / \
  //   1  3 5  7
  const tree = [4, 2, 6, 1, 3, 5, 7];
  const labels = ["root", "L", "R", "LL", "LR", "RL", "RR"];

  steps.push({
    elements: tree.map((v, i) => ({ value: v, state: "default" as const, label: labels[i] })),
    label: "Binary Search Tree — In-order traversal: Left → Root → Right",
  });

  // In-order: 1, 2, 3, 4, 5, 6, 7
  const inorder = [3, 1, 4, 0, 5, 2, 6]; // indices in tree array
  const visited = new Set<number>();

  for (const idx of inorder) {
    steps.push({
      elements: tree.map((v, i) => ({
        value: v,
        state: i === idx ? "current" : visited.has(i) ? "visited" : "default",
        label: labels[i],
      })),
      label: `Visit node ${tree[idx]}`,
    });
    visited.add(idx);
    steps.push({
      elements: tree.map((v, i) => ({
        value: v,
        state: visited.has(i) ? "sorted" : "default",
        label: labels[i],
      })),
      label: `Visited so far: [${Array.from(visited).map(i => tree[i]).join(", ")}]`,
    });
  }

  steps.push({
    elements: tree.map((v) => ({ value: v, state: "sorted" as const })),
    label: "In-order traversal complete: [1, 2, 3, 4, 5, 6, 7] — sorted!",
  });
  return steps;
}

// ─── Concept registry ────────────────────────────────────────────────────────

interface ConceptConfig {
  name: string;
  genSteps: (data?: number[]) => VisStep[];
  defaultData?: number[];
  legend: { state: VisElement["state"]; label: string }[];
  layout?: "horizontal" | "vertical" | "tree";
  connector?: string; // e.g. "→" between elements
}

const CONCEPTS: Record<string, ConceptConfig> = {
  bubble_sort: {
    name: "Bubble Sort",
    genSteps: (d) => genBubbleSort(d || [38, 27, 43, 3, 9, 82, 10]),
    defaultData: [38, 27, 43, 3, 9, 82, 10],
    legend: [
      { state: "comparing", label: "Comparing" },
      { state: "swapping", label: "Swapped" },
      { state: "sorted", label: "Sorted" },
    ],
  },
  selection_sort: {
    name: "Selection Sort",
    genSteps: (d) => genSelectionSort(d || [64, 25, 12, 22, 11]),
    defaultData: [64, 25, 12, 22, 11],
    legend: [
      { state: "active", label: "Min candidate" },
      { state: "comparing", label: "Scanning" },
      { state: "sorted", label: "Sorted" },
    ],
  },
  insertion_sort: {
    name: "Insertion Sort",
    genSteps: (d) => genInsertionSort(d || [12, 11, 13, 5, 6]),
    defaultData: [12, 11, 13, 5, 6],
    legend: [
      { state: "active", label: "Key" },
      { state: "swapping", label: "Shifting" },
      { state: "sorted", label: "Sorted" },
    ],
  },
  merge_sort: {
    name: "Merge Sort",
    genSteps: (d) => genMergeSort(d || [38, 27, 43, 3, 9, 82, 10]),
    defaultData: [38, 27, 43, 3, 9, 82, 10],
    legend: [
      { state: "left", label: "Left half" },
      { state: "right", label: "Right half" },
      { state: "merged", label: "Merged" },
      { state: "sorted", label: "Sorted" },
    ],
  },
  binary_search: {
    name: "Binary Search",
    genSteps: (d) => genBinarySearch(d || [3, 9, 10, 27, 38, 43, 82]),
    defaultData: [3, 9, 10, 27, 38, 43, 82],
    legend: [
      { state: "active", label: "Mid" },
      { state: "comparing", label: "Search range" },
      { state: "visited", label: "Eliminated" },
      { state: "found", label: "Found" },
    ],
  },
  linear_search: {
    name: "Linear Search",
    genSteps: (d) => {
      const arr = d || [38, 27, 43, 3, 9, 82, 10];
      const target = arr[4] ?? arr[arr.length - 1];
      const steps: VisStep[] = [];
      steps.push({ elements: arr.map(v => ({ value: v, state: "default" as const })), label: `Search for ${target} — check each element one by one` });
      for (let i = 0; i < arr.length; i++) {
        steps.push({
          elements: arr.map((v, k) => ({ value: v, state: k === i ? "active" : k < i ? "visited" : "default", label: k === i ? "i" : undefined })),
          label: arr[i] === target ? `Found ${target} at index ${i}!` : `Check index ${i}: ${arr[i]} ≠ ${target}`,
        });
        if (arr[i] === target) {
          steps.push({
            elements: arr.map((v, k) => ({ value: v, state: k === i ? "found" : "visited" })),
            label: `Linear search complete: ${target} found at index ${i} after ${i + 1} comparisons`,
          });
          return steps;
        }
      }
      steps.push({ elements: arr.map(v => ({ value: v, state: "visited" as const })), label: `${target} not found after checking all ${arr.length} elements` });
      return steps;
    },
    legend: [
      { state: "active", label: "Checking" },
      { state: "visited", label: "Checked" },
      { state: "found", label: "Found" },
    ],
  },
  stack: {
    name: "Stack (LIFO)",
    genSteps: () => genStack(),
    legend: [
      { state: "pushed", label: "Pushed" },
      { state: "active", label: "Top" },
      { state: "found", label: "Peek" },
    ],
    layout: "vertical",
  },
  queue: {
    name: "Queue (FIFO)",
    genSteps: () => genQueue(),
    legend: [
      { state: "pushed", label: "Enqueued" },
      { state: "active", label: "Front" },
    ],
    connector: "→",
  },
  linked_list: {
    name: "Linked List",
    genSteps: () => genLinkedList(),
    legend: [
      { state: "pushed", label: "Added" },
      { state: "current", label: "Current" },
      { state: "visited", label: "Visited" },
    ],
    connector: "→",
  },
  arraylist: {
    name: "ArrayList",
    genSteps: () => genArrayList(),
    legend: [
      { state: "pushed", label: "Added/Inserted" },
      { state: "swapping", label: "Shifted" },
      { state: "found", label: "Accessed" },
    ],
  },
  recursion: {
    name: "Recursion (Call Stack)",
    genSteps: () => genRecursion(),
    legend: [
      { state: "pushed", label: "New call" },
      { state: "active", label: "Returning" },
      { state: "found", label: "Result" },
    ],
    layout: "vertical",
  },
  tree_traversal: {
    name: "BST In-Order Traversal",
    genSteps: () => genTreeTraversal(),
    legend: [
      { state: "current", label: "Visiting" },
      { state: "visited", label: "Visited" },
      { state: "sorted", label: "Complete" },
    ],
    layout: "tree",
  },
};

// Aliases so the AI can use various names
const ALIASES: Record<string, string> = {
  bubble: "bubble_sort",
  selection: "selection_sort",
  insertion: "insertion_sort",
  merge: "merge_sort",
  binary: "binary_search",
  linear: "linear_search",
  bst: "tree_traversal",
  bst_traversal: "tree_traversal",
  inorder: "tree_traversal",
  in_order: "tree_traversal",
  preorder: "tree_traversal",
  postorder: "tree_traversal",
  factorial: "recursion",
  call_stack: "recursion",
  fifo: "queue",
  lifo: "stack",
  singly_linked_list: "linked_list",
  doubly_linked_list: "linked_list",
  array_list: "arraylist",
  array: "arraylist",
};

function resolveType(type: string): string {
  const normalized = type.toLowerCase().replace(/[\s-]+/g, "_");
  return ALIASES[normalized] || normalized;
}

// ─── Visualizer component ────────────────────────────────────────────────────

interface ConceptVisualizerProps {
  type: string;
  data?: number[];
}

export default function ConceptVisualizer({ type, data }: ConceptVisualizerProps) {
  const resolvedType = resolveType(type);
  const config = CONCEPTS[resolvedType];

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(() => {
    if (!config) return [];
    return config.genSteps(data || config.defaultData);
  }, [resolvedType, data]);

  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
  }, [resolvedType]);

  useEffect(() => {
    if (playing && stepIdx < steps.length - 1) {
      intervalRef.current = setTimeout(() => setStepIdx(i => i + 1), speed);
    } else if (stepIdx >= steps.length - 1) {
      setPlaying(false);
    }
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [playing, stepIdx, steps.length, speed]);

  if (!config || steps.length === 0) {
    return (
      <div className="my-3 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 text-xs text-yellow-700 dark:text-yellow-300">
        Visualization not available for: {type}
      </div>
    );
  }

  const current = steps[stepIdx];
  const isFinal = stepIdx === steps.length - 1;
  const layout = config.layout || "horizontal";

  return (
    <div className="my-4 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/30 dark:to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
          {config.name}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          Step {stepIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Elements visualization */}
      <div className={`flex justify-center mb-2 px-1 ${
        layout === "vertical" ? "flex-col items-center gap-1" :
        layout === "tree" ? "flex-wrap gap-1.5" :
        "gap-1.5"
      }`}>
        {current.elements.map((el, i) => {
          const style = STATE_STYLES[el.state] || STATE_STYLES.default;
          const isSpecial = el.state !== "default";
          return (
            <div key={`el-${i}`} className={layout === "vertical" ? "flex items-center gap-2" : "flex flex-col items-center"}>
              <div className="flex items-center gap-0.5">
                {/* Connector arrow for linked structures */}
                {i > 0 && config.connector && layout !== "vertical" && (
                  <span className="text-slate-400 dark:text-slate-500 text-xs mx-0.5">{config.connector}</span>
                )}
                <motion.div
                  className={`w-10 sm:w-12 h-10 sm:h-12 rounded-lg border-2 ${style.border} ${style.bg} flex items-center justify-center transition-colors duration-300`}
                  animate={{ scale: isSpecial ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <span className={`text-sm sm:text-base font-bold font-mono ${style.text} transition-colors duration-300`}>
                    {el.value}
                  </span>
                </motion.div>
              </div>
              {/* Pointer label below */}
              <div className="h-4 flex items-center justify-center">
                {el.label && (
                  <motion.span
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400"
                  >
                    {el.label}
                  </motion.span>
                )}
              </div>
              {/* Vertical connector */}
              {layout === "vertical" && i < current.elements.length - 1 && (
                <span className="text-slate-400 text-xs">↑</span>
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
            isFinal
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              : "bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
          }`}
        >
          <p className={`text-xs font-medium ${
            isFinal ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"
          }`}>
            {current.label}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={() => { setStepIdx(0); setPlaying(false); }}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setStepIdx(i => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className={`px-4 py-1.5 text-[11px] rounded-md font-semibold transition-colors ${
            playing ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => setStepIdx(i => Math.min(steps.length - 1, i + 1))}
          disabled={stepIdx >= steps.length - 1}
          className="px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>

      {/* Speed */}
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
          className={`h-full rounded-full ${isFinal ? "bg-emerald-500" : "bg-blue-500"}`}
          animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center flex-wrap">
        {config.legend.map((l) => {
          const s = STATE_STYLES[l.state];
          return (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <span className={`w-3 h-3 rounded border-2 ${s.border} ${s.bg}`} />
              {l.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Export the list of available types for the AI prompt
export const AVAILABLE_VISUALIZATIONS = Object.keys(CONCEPTS);
