"use client";

import { Trophy, Gamepad2, Target, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Badge } from "@/presentation/components/ui/badge";
import type { ProfileStats, RecentMatch } from "./types";

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function HomeTab({
  stats,
  recentMatches,
}: {
  stats: ProfileStats | null;
  recentMatches: RecentMatch[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Gamepad2 className="h-5 w-5" />} label="Partidas" value={stats?.gamesPlayed ?? 0} />
        <Stat icon={<Trophy className="h-5 w-5" />} label="Victorias" value={stats?.gamesWon ?? 0} />
        <Stat icon={<Percent className="h-5 w-5" />} label="% Victorias" value={`${stats?.winRate ?? 0}%`} />
        <Stat icon={<Target className="h-5 w-5" />} label="Puntos" value={stats?.totalPoints ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partidas recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no has jugado partidas.</p>
          )}
          {recentMatches.map((m) => (
            <div
              key={m.matchId}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div>
                <p className="font-medium">{m.roomName}</p>
                <p className="text-xs text-muted-foreground">
                  {m.endedAt ? new Date(m.endedAt).toLocaleString("es") : "En curso"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{m.finalScore} pts</span>
                <Badge variant={m.won ? "success" : "secondary"}>{m.won ? "Victoria" : "Derrota"}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
