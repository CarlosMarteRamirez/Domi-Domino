"use client";

import * as React from "react";
import type { MatchActionDto } from "@/shared/socket/contract";
import { MATCH_ANIM_MS } from "@/shared/socket/contract";

type SeatPosition = "top" | "bottom" | "left" | "right";

function playerSeatPosition(
  playerId: string,
  currentUserId: string,
  mySeat: number,
  playerCount: number,
  playerSeats: Map<string, number>,
): SeatPosition {
  const seat = playerSeats.get(playerId) ?? 0;
  const relative = (seat - mySeat + playerCount) % playerCount;
  if (playerCount === 2) return relative === 0 ? "bottom" : "top";
  const map: SeatPosition[] = ["bottom", "right", "top", "left"];
  return map[relative % 4] ?? "top";
}

const ORIGIN: Record<SeatPosition, { x: string; y: string }> = {
  bottom: { x: "50%", y: "88%" },
  top: { x: "50%", y: "12%" },
  left: { x: "12%", y: "48%" },
  right: { x: "88%", y: "48%" },
};

interface Props {
  action: MatchActionDto | null;
  currentUserId: string;
  mySeat: number;
  playerCount: number;
  playerSeats: Map<string, number>;
}

export function MatchAnimationLayer({
  action,
  currentUserId,
  mySeat,
  playerCount,
  playerSeats,
}: Props) {
  if (!action) return null;

  if (action.type === "play") {
    return null;
  }

  if (action.type === "pass") {
    const seat = playerSeatPosition(
      action.playerId,
      currentUserId,
      mySeat,
      playerCount,
      playerSeats,
    );
    const pos = ORIGIN[seat];
    return (
      <div className="pointer-events-none absolute inset-0 z-30">
        <div
          className="absolute animate-pass-float"
          style={
            {
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              "--pass-duration": `${MATCH_ANIM_MS.pass}ms`,
            } as React.CSSProperties
          }
        >
          <div className="rounded-full border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-center shadow-lg backdrop-blur-sm">
            <p className="text-xs font-semibold text-amber-200">{action.displayName}</p>
            <p className="text-sm font-bold text-amber-100">Pasa 🃏</p>
          </div>
        </div>
      </div>
    );
  }

  if (action.type === "deal") {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <div className="relative h-full w-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 h-8 w-5 animate-deal-burst rounded-sm bg-slate-100 shadow-md ring-1 ring-black/20"
              style={{
                animationDelay: `${i * 80}ms`,
                transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateX(${40 + i * 8}px)`,
              }}
            />
          ))}
          <p
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-domino-cream drop-shadow-lg"
            style={{ animation: `round-banner ${MATCH_ANIM_MS.deal}ms ease-out forwards` }}
          >
            Repartiendo fichas…
          </p>
        </div>
      </div>
    );
  }

  if (action.type === "roundEnd") {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <div
          className="animate-round-banner rounded-2xl border border-domino-blue-light/50 bg-domino-blue/80 px-8 py-5 text-center shadow-2xl backdrop-blur-md"
          style={{ "--round-duration": `${MATCH_ANIM_MS.roundEnd}ms` } as React.CSSProperties}
        >
          <p className="text-sm uppercase tracking-widest text-domino-cream/80">Fin de ronda</p>
          <p className="mt-1 text-xl font-bold text-white">{action.message}</p>
        </div>
      </div>
    );
  }

  return null;
}

/** Confeti decorativo para el overlay de resultados. */
export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const colors = ["#4091c9", "#df2e1e", "#fedfd4", "#fbbf24", "#34d399"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <span
          key={i}
          className="absolute animate-confetti-fall block h-2 w-2 rounded-sm"
          style={{
            left: `${(i * 2.5) % 100}%`,
            top: "-5%",
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 10) * 0.25}s`,
            "--confetti-duration": `${2.5 + (i % 5) * 0.4}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
