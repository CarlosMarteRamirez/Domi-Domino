"use client";

import { Card, CardContent } from "@/presentation/components/ui/card";
import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/presentation/lib/utils";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import type { LobbyMember } from "@/shared/socket/contract";

interface Props {
  state: MatchState;
  members: LobbyMember[];
}

export function Scoreboard({ state, members }: Props) {
  const nameOf = (id: string) =>
    members.find((m) => m.userId === id)?.displayName ?? id.slice(0, 6);

  const teams = Object.keys(state.teamScores).map(Number).sort();

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Objetivo</span>
          <Badge variant="outline">{state.config.targetScore} pts</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {teams.map((t) => (
            <div
              key={t}
              className={cn(
                "rounded-lg border border-border p-3 text-center",
                state.winningTeam === t && "border-primary bg-primary/10",
              )}
            >
              <p className="text-xs text-muted-foreground">Equipo {t + 1}</p>
              <p className="text-2xl font-bold">{state.teamScores[t] ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {state.players.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1 text-sm",
                p.isCurrentTurn && "bg-accent",
              )}
            >
              <span className="flex items-center gap-2">
                {p.isCurrentTurn && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
                {nameOf(p.id)}
                <span className="text-xs text-muted-foreground">(Eq. {p.teamIndex + 1})</span>
              </span>
              <Badge variant="secondary">{p.handCount} fichas</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
