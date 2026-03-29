"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState } from "react";
import { ReactSketchCanvas, type ReactSketchCanvasRef } from "react-sketch-canvas";
import {
  Pen,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Minus,
  Circle,
} from "lucide-react";

export interface DrawingCanvasHandle {
  exportImage: () => Promise<string>;
  clearCanvas: () => void;
}

interface DrawingCanvasProps {
  height?: string;
  readOnly?: boolean;
  className?: string;
}

// Lined paper background as inline SVG data URL
const LINED_BG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40">
  <line x1="0" y1="39" x2="100" y2="39" stroke="#d1d5db" stroke-width="0.5"/>
</svg>
`)}`;

const GRID_BG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
  <line x1="0" y1="39.5" x2="40" y2="39.5" stroke="#e5e7eb" stroke-width="0.5"/>
  <line x1="39.5" y1="0" x2="39.5" y2="40" stroke="#e5e7eb" stroke-width="0.5"/>
</svg>
`)}`;

type PaperStyle = "blank" | "lined" | "grid";

const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Blue", value: "#2563eb" },
  { name: "Red", value: "#dc2626" },
];

const STROKE_WIDTHS = [
  { name: "Fine", value: 2, icon: <Minus className="w-3 h-3" /> },
  { name: "Medium", value: 4, icon: <Circle className="w-2.5 h-2.5" /> },
  { name: "Thick", value: 8, icon: <Circle className="w-4 h-4" /> },
];

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas({ height = "400px", readOnly = false, className = "" }, ref) {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [strokeColor, setStrokeColor] = useState("#000000");
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [isEraser, setIsEraser] = useState(false);
    const [paperStyle, setPaperStyle] = useState<PaperStyle>("lined");

    useImperativeHandle(ref, () => ({
      exportImage: async () => {
        if (!canvasRef.current) {
          console.warn("DrawingCanvas: canvasRef is null");
          return "";
        }
        try {
          // exportImage returns a data:image/png;base64,... string
          const dataUrl = await canvasRef.current.exportImage("png");
          return dataUrl || "";
        } catch (err) {
          console.error("DrawingCanvas: export failed", err);
          return "";
        }
      },
      clearCanvas: () => {
        canvasRef.current?.clearCanvas();
      },
    }));

    const toggleEraser = () => {
      if (isEraser) {
        canvasRef.current?.eraseMode(false);
        setIsEraser(false);
      } else {
        canvasRef.current?.eraseMode(true);
        setIsEraser(true);
      }
    };

    const selectPen = () => {
      canvasRef.current?.eraseMode(false);
      setIsEraser(false);
    };

    return (
      <div className={`flex flex-col ${className}`}>
        {/* Toolbar */}
        {!readOnly && (
          <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-wrap">
            {/* Pen / Eraser */}
            <div className="flex items-center gap-0.5 mr-2">
              <button
                onClick={selectPen}
                className={`p-1.5 rounded-md transition-colors ${
                  !isEraser
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                title="Pen"
              >
                <Pen className="w-4 h-4" />
              </button>
              <button
                onClick={toggleEraser}
                className={`p-1.5 rounded-md transition-colors ${
                  isEraser
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

            {/* Colors */}
            <div className="flex items-center gap-1 mr-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setStrokeColor(c.value); selectPen(); }}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    strokeColor === c.value && !isEraser
                      ? "border-blue-500 scale-110"
                      : "border-slate-300 dark:border-slate-600 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

            {/* Stroke widths */}
            <div className="flex items-center gap-0.5 mr-2">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  onClick={() => setStrokeWidth(sw.value)}
                  className={`p-1.5 rounded-md transition-colors ${
                    strokeWidth === sw.value
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                      : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={sw.name}
                >
                  {sw.icon}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

            {/* Paper style */}
            <div className="flex items-center gap-0.5 mr-2">
              {([
                { key: "lined" as PaperStyle, label: "Lined" },
                { key: "grid" as PaperStyle, label: "Grid" },
                { key: "blank" as PaperStyle, label: "Blank" },
              ]).map((ps) => (
                <button
                  key={ps.key}
                  onClick={() => setPaperStyle(ps.key)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    paperStyle === ps.key
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                      : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {ps.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

            {/* Undo / Redo / Clear */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => canvasRef.current?.undo()}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => canvasRef.current?.redo()}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => canvasRef.current?.clearCanvas()}
                className="p-1.5 rounded-md text-slate-500 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                title="Clear"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-b-lg overflow-hidden"
          style={{ height }}
        >
          <ReactSketchCanvas
            ref={canvasRef}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            eraserWidth={20}
            canvasColor="white"
            backgroundImage={paperStyle === "lined" ? LINED_BG : paperStyle === "grid" ? GRID_BG : undefined}
            preserveBackgroundImageAspectRatio="none"
            style={{
              border: "none",
              borderRadius: 0,
              width: "100%",
              height: "100%",
            }}
            allowOnlyPointerType="all"
          />
        </div>
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;
