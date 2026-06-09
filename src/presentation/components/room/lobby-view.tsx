"use client";

import * as React from "react";
import { Check, Copy, Crown, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Badge } from "@/presentation/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { createInviteLinkAction } from "@/presentation/actions/invite-actions";
import type { LobbyState, RoomConfigDto } from "@/shared/socket/contract";

interface Props {
  lobby: LobbyState;
  currentUserId: string;
  onReady: (ready: boolean) => void;
  onSetTeam: (team: number) => void;
  onUpdateConfig: (patch: Partial<RoomConfigDto>) => void;
}

export function LobbyView({ lobby, currentUserId, onReady, onSetTeam, onUpdateConfig }: Props) {
  const me = lobby.members.find((m) => m.userId === currentUserId);
  const isHost = lobby.hostId === currentUserId;
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const isTwoPlayer = lobby.config.maxPlayers === 2;

  React.useEffect(() => {
    if (!lobby.matchStartsAt) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [lobby.matchStartsAt]);

  const startSecondsLeft = lobby.matchStartsAt
    ? Math.max(0, Math.ceil((lobby.matchStartsAt - now) / 1000))
    : null;

  async function makeInvite() {
    const result = await createInviteLinkAction(lobby.code);
    setInviteUrl(result.url);
  }

  function copy() {
    const url = inviteUrl ?? `${window.location.origin}/room/${lobby.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-4 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {lobby.name}
              <Badge variant="outline">Sala {lobby.code}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: lobby.config.maxPlayers }).map((_, seat) => {
                const member = lobby.members.find((m) => m.seat === seat);
                return (
                  <div key={seat} className="flex items-center justify-between rounded-lg border border-border p-3">
                    {member ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            {member.image && <AvatarImage src={member.image} />}
                            <AvatarFallback>{member.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="flex items-center gap-1 text-sm font-medium">
                              {member.displayName}
                              {member.isHost && <Crown className="h-3 w-3 text-amber-400" />}
                            </p>
                            <p className="text-xs text-muted-foreground">Equipo {member.team + 1}</p>
                          </div>
                        </div>
                        <Badge variant={member.isReady ? "success" : "secondary"}>
                          {member.isReady ? "Listo" : "Esperando"}
                        </Badge>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Asiento {seat + 1} libre</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={me?.isReady ? "secondary" : "default"} onClick={() => onReady(!me?.isReady)}>
                {me?.isReady ? "Cancelar listo" : "Marcar listo"}
              </Button>
              {lobby.config.teamSelection === "manual" && (
                <Select value={String(me?.team ?? 0)} onValueChange={(v) => onSetTeam(Number(v))}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Equipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Equipo 1</SelectItem>
                    <SelectItem value="1">Equipo 2</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {startSecondsLeft !== null && startSecondsLeft > 0 && (
              <p className="text-sm font-medium text-domino-blue-light">
                La partida inicia en {startSecondsLeft}…
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Invitar</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full" onClick={makeInvite}>
              <Link2 className="mr-1 h-4 w-4" /> Generar enlace
            </Button>
            <Button variant="secondary" className="w-full" onClick={copy}>
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copiado" : "Copiar enlace de sala"}
            </Button>
            {inviteUrl && <p className="break-all text-xs text-muted-foreground">{inviteUrl}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Configuración</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ConfigRow label="Objetivo">
              <Select
                disabled={!isHost}
                value={String(lobby.config.targetScore)}
                onValueChange={(v) => onUpdateConfig({ targetScore: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[100, 200, 400, 500].map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConfigRow>
            <ConfigRow label="Tranque">
              <Select
                disabled={!isHost || isTwoPlayer}
                value={isTwoPlayer ? "individual" : lobby.config.blockMode}
                onValueChange={(v) => onUpdateConfig({ blockMode: v as "individual" | "parejas" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!isTwoPlayer && <SelectItem value="parejas">Parejas</SelectItem>}
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </ConfigRow>
            <ConfigRow label="Bono pase">
              <Select
                disabled={!isHost}
                value={String(lobby.config.passBonus)}
                onValueChange={(v) => onUpdateConfig({ passBonus: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 25, 30].map((p) => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </ConfigRow>
            <ConfigRow label="Equipos">
              <Select
                disabled={!isHost}
                value={lobby.config.teamSelection}
                onValueChange={(v) => onUpdateConfig({ teamSelection: v as "manual" | "auto" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </ConfigRow>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="w-32">{children}</div>
    </div>
  );
}
