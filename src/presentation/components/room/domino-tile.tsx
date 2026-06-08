"use client";

import * as React from "react";
import { cn } from "@/presentation/lib/utils";

// Pip positions on a 3x3 grid for each value 0-6.
const PIP_LAYOUT: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Half({ value, vertical }: { value: number; vertical?: boolean }) {
  const active = new Set(PIP_LAYOUT[value] ?? []);
  return (
    <div className={cn("grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5 p-1", vertical && "")}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {active.has(i) && <span className="block h-1.5 w-1.5 rounded-full bg-slate-900" />}
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
  selected?: boolean;
  playable?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  className?: string;
}

export function DominoTile({
  low,
  high,
  orientation = "vertical",
  selected,
  playable,
  draggable,
  onClick,
  onDragStart,
  className,
}: Props) {
  const resolved =
    orientation === "auto" ? (low === high ? "vertical" : "horizontal") : orientation;
  const horizontal = resolved === "horizontal";
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      disabled={!onClick && !draggable}
      className={cn(
        "relative flex items-stretch rounded-md bg-slate-100 shadow-md ring-1 ring-black/20 transition",
        horizontal ? "h-10 w-20 flex-row" : "h-20 w-10 flex-col",
        playable && "ring-2 ring-primary hover:-translate-y-1",
        selected && "-translate-y-1 ring-2 ring-amber-400",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
      aria-label={`Ficha ${low}-${high}`}
    >
      <div className={cn("flex-1", horizontal ? "border-r border-slate-400" : "border-b border-slate-400")}>
        <Half value={high} />
      </div>
      <div className="flex-1">
        <Half value={low} />
      </div>
    </button>
  );
}
