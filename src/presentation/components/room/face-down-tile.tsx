"use client";

import * as React from "react";
import { cn } from "@/presentation/lib/utils";


/** Pila de fichas boca abajo con contador, estilo mesa móvil. */
export function TileStack({ count, className }: { count: number; className?: string }) {
  const visible = Math.min(count, 5);
  return (
    <div className={cn("relative flex items-end", className)}>
      <span className="relative z-10 ml-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-domino-blue text-xs font-bold text-white shadow">
        {count}
      </span>
    </div>
  );
}
