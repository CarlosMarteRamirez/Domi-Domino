"use client";

import * as React from "react";
import Link from "next/link";
import { Trophy, Medal } from "lucide-react";
import { Button } from "@/presentation/components/ui/button";
import { ConfettiBurst } from "./match-animation-layer";
import { cn } from "@/presentation/lib/utils";

interface Props {
  winningTeam: number;
  teamScores: Record<number, number>;
  myTeam: number;
  visible: boolean;
}

export function MatchResultsOverlay({ winningTeam, teamScores, myTeam, visible }: Props) {
  const [show, setShow] = React.useState(false);
  const won = winningTeam === myTeam;
  const teams = Object.keys(teamScores).map(Number).sort();

  React.useEffect(() => {
    if (visible) {
      const t = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(t);
    }
    setShow(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        show ? "animate-results-backdrop" : "opacity-0",
      )}
      style={{ backgroundColor: "rgba(6, 18, 31, 0.82)" }}
    >
      <ConfettiBurst active={show && won} />
      <div
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-domino-blue-light/40 bg-card p-8 text-center shadow-2xl",
          show && "animate-results-card",
        )}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
          {won ? (
            <Trophy className="h-9 w-9 animate-trophy-bounce text-amber-400" />
          ) : (
            <Medal className="h-9 w-9 text-muted-foreground" />
          )}
        </div>

        <h2 className="text-2xl font-bold">
          {won ? "¡Victoria!" : "Partida terminada"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Ganó el <span className="font-semibold text-domino-blue-light">Equipo {winningTeam + 1}</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {teams.map((t, i) => (
            <div
              key={t}
              className={cn(
                "rounded-xl border p-4 transition",
                t === winningTeam
                  ? "border-amber-400/60 bg-amber-500/10"
                  : "border-border bg-secondary/40",
              )}
              style={{ animationDelay: `${300 + i * 150}ms` }}
            >
              <p className="text-xs text-muted-foreground">Equipo {t + 1}</p>
              <p className="text-2xl font-bold text-domino-blue-light">{teamScores[t] ?? 0}</p>
              {t === winningTeam && (
                <p className="mt-1 text-xs font-medium text-amber-300">Ganador</p>
              )}
            </div>
          ))}
        </div>

        <Button asChild className="mt-8 w-full" size="lg">
          <Link href="/dashboard">Volver al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
