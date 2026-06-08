"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Check, X, Trash2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui/card";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Badge } from "@/presentation/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/components/ui/avatar";
import {
  searchUsersAction,
  sendFriendRequestAction,
  respondFriendRequestAction,
  removeFriendAction,
} from "@/presentation/actions/friend-actions";
import type { FriendUser, PendingRequest } from "./types";

function UserRow({
  user,
  children,
}: {
  user: FriendUser;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {user.image && <AvatarImage src={user.image} alt={user.displayName} />}
          <AvatarFallback>{(user.displayName || user.username).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-muted-foreground">@{user.username}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function FriendsTab({
  friends,
  requests,
  outgoingPendingIds,
}: {
  friends: FriendUser[];
  requests: PendingRequest[];
  outgoingPendingIds: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<FriendUser[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [sentIds, setSentIds] = React.useState<Set<string>>(() => new Set(outgoingPendingIds));
  const [error, setError] = React.useState<string | null>(null);

  const friendIds = React.useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const incomingIds = React.useMemo(() => new Set(requests.map((r) => r.user.id)), [requests]);

  React.useEffect(() => {
    setSentIds(new Set(outgoingPendingIds));
  }, [outgoingPendingIds]);

  async function doSearch(value: string) {
    setQuery(value);
    setError(null);
    if (value.trim().length < 2) return setResults([]);
    const found = await searchUsersAction(value);
    setResults(found);
  }

  function sendRequest(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendFriendRequestAction(userId);
        if (result.status === "sent" || result.status === "alreadySent") {
          setSentIds((prev) => new Set([...prev, userId]));
        }
        if (result.status === "incomingPending") router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
      }
    });
  }

  function renderAddButton(user: FriendUser) {
    if (friendIds.has(user.id)) {
      return (
        <Badge variant="secondary" className="shrink-0">
          Ya son amigos
        </Badge>
      );
    }
    if (incomingIds.has(user.id)) {
      return (
        <Badge variant="outline" className="shrink-0">
          Te envió solicitud
        </Badge>
      );
    }
    if (sentIds.has(user.id)) {
      return (
        <Button size="sm" variant="secondary" disabled className="shrink-0">
          <Clock className="mr-1 h-4 w-4" /> Solicitud enviada
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className="shrink-0"
        onClick={() => sendRequest(user.id)}
      >
        <UserPlus className="mr-1 h-4 w-4" /> Agregar
      </Button>
    );
  }

  const act = (fn: () => Promise<unknown>) => () =>
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error");
      }
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buscar jugadores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nombre o usuario..."
              value={query}
              onChange={(e) => doSearch(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {results.map((u) => (
            <UserRow key={u.id} user={u}>
              {renderAddButton(u)}
            </UserRow>
          ))}
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes ({requests.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((r) => (
              <UserRow key={r.friendshipId} user={r.user}>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={pending}
                  onClick={act(() => respondFriendRequestAction(r.friendshipId, true))}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  onClick={act(() => respondFriendRequestAction(r.friendshipId, false))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </UserRow>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mis amigos ({friends.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {friends.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no tienes amigos agregados.</p>
          )}
          {friends.map((f) => (
            <UserRow key={f.id} user={f}>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={act(() => removeFriendAction(f.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </UserRow>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
