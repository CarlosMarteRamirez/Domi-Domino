"use client";

import * as React from "react";
import { cn } from "@/presentation/lib/utils";

// Pip positions on a 3x3 grid (valores 0–5). El 6 usa rejilla distinta según orientación.
const PIP_LAYOUT: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
};

function Pip({ className }: { className?: string }) {
  return <span className={cn("block h-1.5 w-1.5 rounded-full bg-slate-900", className)} />;
}

function HalfSix({ tileHorizontal }: { tileHorizontal: boolean }) {
  // Ficha vertical → 2×3  |  Ficha horizontal → 3×2
  return (
    <div
      className={cn(
        "grid h-full w-full gap-0.5 p-1",
        tileHorizontal ? "grid-cols-3 grid-rows-2" : "grid-cols-2 grid-rows-3",
      )}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          <Pip />
        </div>
      ))}
    </div>
  );
}

function Half({ value, tileHorizontal }: { value: number; tileHorizontal: boolean }) {
  if (value === 6) return <HalfSix tileHorizontal={tileHorizontal} />;

  const active = new Set(PIP_LAYOUT[value] ?? []);
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5 p-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {active.has(i) && <Pip />}
        </div>
      ))}
    </div>
  );
}

interface Props {
  low: number;
  high: number;
  /** "auto": vertical si es doble (low === high), horizontal si no. */
  orientation?: "horizontal" | "vertical" | "auto";
  /** Fila de serpiente fuera de la central: invierte mitades y ajusta el divisor. */
  reversed?: boolean;
  selected?: boolean;
  playable?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  className?: string;
  /** When true, fills the parent box instead of using fixed Tailwind sizes. */
  fillContainer?: boolean;
}

export function DominoTile({
  low,
  high,
  orientation = "vertical",
  reversed = false,
  selected,
  playable,
  draggable,
  onClick,
  onDragStart,
  className,
  fillContainer = false,
}: Props) {
  const resolved =
    orientation === "auto" ? (low === high ? "vertical" : "horizontal") : orientation;
  const horizontal = resolved === "horizontal";
  const flip = horizontal && reversed;
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      disabled={!onClick && !draggable}
      className={cn(
        "relative flex items-stretch rounded-md bg-slate-100 shadow-md ring-1 ring-black/20 transition",
        fillContainer
          ? "h-full w-full"
          : horizontal
            ? "h-10 w-20 flex-row"
            : "h-20 w-10 flex-col",
        fillContainer && (horizontal ? "flex-row" : "flex-col"),
        flip && "flex-row-reverse",
        playable && "ring-2 ring-primary hover:-translate-y-1",
        selected && "-translate-y-1 ring-2 ring-amber-400",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
      aria-label={`Ficha ${low}-${high}`}
    >
      <div
        className={cn(
          "flex-1",
          horizontal
            ? flip
              ? "border-l border-slate-400"
              : "border-r border-slate-400"
            : "border-b border-slate-400",
        )}
      >
        <Half value={high} tileHorizontal={horizontal} />
      </div>
      <div className="flex-1">
        <Half value={low} tileHorizontal={horizontal} />
      </div>
    </button>
  );
}
