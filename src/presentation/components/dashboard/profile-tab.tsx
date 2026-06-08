"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, User2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/components/ui/avatar";
import { updateProfileAction } from "@/presentation/actions/profile-actions";
import type { ProfileAccount } from "./types";

export function ProfileTab({ account }: { account: ProfileAccount }) {
  const router = useRouter();
  const { update } = useSession();
  const [form, setForm] = React.useState({
    username: account.username,
    displayName: account.displayName,
    email: account.email,
    image: account.image ?? "",
    currentPassword: "",
    newPassword: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const initials = (form.displayName || form.username).slice(0, 2).toUpperCase();

  async function submit() {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const updated = await updateProfileAction(form);
      setSuccess(true);
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
      // Refresca la sesión (nombre/avatar en la barra) y los datos del servidor.
      await update({ name: updated.displayName, image: updated.image });
      router.refresh();
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el perfil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User2 className="h-5 w-5" /> Datos de la cuenta
          </CardTitle>
          <CardDescription>Edita la información que guardaste al registrarte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {form.image && <AvatarImage src={form.image} alt={form.displayName} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="image">URL del avatar</Label>
              <Input
                id="image"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="https://ejemplo.com/mi-foto.png"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre visible</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            {account.hasPassword
              ? "Deja estos campos en blanco si no quieres cambiarla."
              : "Tu cuenta usa Google. Puedes establecer una contraseña para entrar con email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {account.hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={(e) => set("currentPassword", e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <Input
              id="newPassword"
              type="password"
              value={form.newPassword}
              onChange={(e) => set("newPassword", e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="flex items-center gap-1 text-sm text-emerald-400">
          <Check className="h-4 w-4" /> Cambios guardados
        </p>
      )}
      <Button onClick={submit} disabled={loading} className="w-full sm:w-auto">
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}
