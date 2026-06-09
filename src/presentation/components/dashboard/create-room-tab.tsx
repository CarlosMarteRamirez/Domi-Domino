"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { createRoomAction } from "@/presentation/actions/room-actions";
import type { CreateRoomInput } from "@/application/rooms";

export function CreateRoomTab() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CreateRoomInput>({
    name: "",
    visibility: "PUBLIC",
    maxPlayers: 4,
    targetScore: 200,
    blockMode: "parejas",
    passBonus: 25,
    teamSelection: "auto",
  });

  function set<K extends keyof CreateRoomInput>(key: K, value: CreateRoomInput[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "maxPlayers" && value === 2) next.blockMode = "individual";
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (form.name.trim().length < 3) return setError("El nombre debe tener al menos 3 caracteres");
    setLoading(true);
    try {
      const { code } = await createRoomAction(form);
      router.push(`/room/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la sala");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar nueva sala</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre de la sala</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Mesa de los campeones" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Visibilidad</Label>
            <Select value={form.visibility} onValueChange={(v) => set("visibility", v as CreateRoomInput["visibility"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Pública</SelectItem>
                <SelectItem value="PRIVATE">Privada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jugadores</Label>
            <Select value={String(form.maxPlayers)} onValueChange={(v) => set("maxPlayers", Number(v) as 2 | 4)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 jugadores</SelectItem>
                <SelectItem value="4">4 (parejas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Objetivo de puntos</Label>
            <Select value={String(form.targetScore)} onValueChange={(v) => set("targetScore", Number(v) as CreateRoomInput["targetScore"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[100, 200, 400, 500].map((p) => (
                  <SelectItem key={p} value={String(p)}>{p} puntos</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modalidad de tranque</Label>
            <Select
              value={form.maxPlayers === 2 ? "individual" : form.blockMode}
              disabled={form.maxPlayers === 2}
              onValueChange={(v) => set("blockMode", v as CreateRoomInput["blockMode"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {form.maxPlayers === 4 && <SelectItem value="parejas">Parejas</SelectItem>}
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bono por pase completo</Label>
            <Select value={String(form.passBonus)} onValueChange={(v) => set("passBonus", Number(v) as CreateRoomInput["passBonus"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin bono</SelectItem>
                <SelectItem value="25">25 puntos</SelectItem>
                <SelectItem value="30">30 puntos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Selección de equipos</Label>
            <Select value={form.teamSelection} onValueChange={(v) => set("teamSelection", v as CreateRoomInput["teamSelection"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automática</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={loading}>
          {loading ? "Creando..." : "Crear sala"}
        </Button>
      </CardContent>
    </Card>
  );
}
