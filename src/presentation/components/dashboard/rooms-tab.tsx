"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Target, Crown } from "lucide-react";
import { Card, CardContent } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Badge } from "@/presentation/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import type { PublicRoom } from "./types";

export function RoomsTab({ rooms }: { rooms: PublicRoom[] }) {
  const [target, setTarget] = React.useState<string>("all");
  const [players, setPlayers] = React.useState<string>("all");
  const [mode, setMode] = React.useState<string>("all");

  const filtered = rooms.filter(
    (r) =>
      (target === "all" || r.targetScore === Number(target)) &&
      (players === "all" || r.maxPlayers === Number(players)) &&
      (mode === "all" || r.blockMode === mode),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue placeholder="Objetivo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los puntos</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="400">400</SelectItem>
            <SelectItem value="500">500</SelectItem>
          </SelectContent>
        </Select>
        <Select value={players} onValueChange={setPlayers}>
          <SelectTrigger><SelectValue placeholder="Jugadores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquiera</SelectItem>
            <SelectItem value="2">2 jugadores</SelectItem>
            <SelectItem value="4">4 jugadores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda modalidad</SelectItem>
            <SelectItem value="parejas">Parejas</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay salas públicas que coincidan. ¡Crea una!
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Crown className="h-3 w-3" /> {r.host.displayName}
                  </p>
                </div>
                <Badge variant={r.status === "LOBBY" ? "success" : "warning"}>
                  {r.status === "LOBBY" ? "Esperando" : "En juego"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">
                  <Users className="mr-1 h-3 w-3" /> {r.players}/{r.maxPlayers}
                </Badge>
                <Badge variant="outline">
                  <Target className="mr-1 h-3 w-3" /> {r.targetScore} pts
                </Badge>
                <Badge variant="outline">{r.blockMode === "parejas" ? "Parejas" : "Individual"}</Badge>
                <Badge variant="outline">Bono {r.passBonus}</Badge>
              </div>
              <Button asChild className="w-full" disabled={r.status !== "LOBBY"}>
                <Link href={`/room/${r.code}`}>{r.status === "LOBBY" ? "Unirse" : "Ver sala"}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
