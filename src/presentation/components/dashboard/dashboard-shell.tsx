"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { LogOut, Home, Users, ListChecks, PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/components/ui/avatar";
import { Button } from "@/presentation/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import { HomeTab } from "./home-tab";
import { FriendsTab } from "./friends-tab";
import { RoomsTab } from "./rooms-tab";
import { CreateRoomTab } from "./create-room-tab";
import { ProfileTab } from "./profile-tab";
import type {
  DashboardUser,
  FriendUser,
  PendingRequest,
  ProfileAccount,
  ProfileStats,
  PublicRoom,
  RecentMatch,
} from "./types";

interface Props {
  user: DashboardUser;
  account: ProfileAccount;
  stats: ProfileStats | null;
  recentMatches: RecentMatch[];
  friends: FriendUser[];
  requests: PendingRequest[];
  outgoingPendingIds: string[];
  rooms: PublicRoom[];
}

/** Ficha de dominó azul/rojo estilo Domino's como logo. */
function DominoLogo() {
  return (
    <div className="flex h-10 w-10 flex-col overflow-hidden rounded-lg shadow ring-1 ring-white/10">
      <div className="flex flex-1 items-center justify-center bg-domino-blue">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </div>
      <div className="h-px w-full bg-white/30" />
      <div className="flex flex-1 items-center justify-center bg-domino-red">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      </div>
    </div>
  );
}

export function DashboardShell({
  user,
  account,
  stats,
  recentMatches,
  friends,
  requests,
  outgoingPendingIds,
  rooms,
}: Props) {
  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();
  const [profileOpen, setProfileOpen] = React.useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DominoLogo />
          <div>
            <h1 className="text-xl font-bold leading-tight">Dominó Online</h1>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="rounded-full ring-offset-background transition hover:ring-2 hover:ring-ring hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Abrir perfil"
          >
            <Avatar className="cursor-pointer">
              {user.image && <AvatarImage src={user.image} alt={user.displayName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })} className="cursor-pointer">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mi perfil</DialogTitle>
          </DialogHeader>
          <ProfileTab account={account} />
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="home">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="home">
            <Home className="mr-1 h-4 w-4" /> Inicio
          </TabsTrigger>
          <TabsTrigger value="friends">
            <Users className="mr-1 h-4 w-4" /> Amigos
            {requests.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                {requests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <ListChecks className="mr-1 h-4 w-4" /> Salas
          </TabsTrigger>
          <TabsTrigger value="create">
            <PlusCircle className="mr-1 h-4 w-4" /> Crear
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home">
          <HomeTab stats={stats} recentMatches={recentMatches} />
        </TabsContent>
        <TabsContent value="friends">
          <FriendsTab
            friends={friends}
            requests={requests}
            outgoingPendingIds={outgoingPendingIds}
          />
        </TabsContent>
        <TabsContent value="rooms">
          <RoomsTab rooms={rooms} />
        </TabsContent>
        <TabsContent value="create">
          <CreateRoomTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
