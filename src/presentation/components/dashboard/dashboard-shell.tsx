"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { LogOut, Home, Users, ListChecks, PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/presentation/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/components/ui/avatar";
import { Button } from "@/presentation/components/ui/button";
import { HomeTab } from "./home-tab";
import { FriendsTab } from "./friends-tab";
import { RoomsTab } from "./rooms-tab";
import { CreateRoomTab } from "./create-room-tab";
import type {
  DashboardUser,
  FriendUser,
  PendingRequest,
  ProfileStats,
  PublicRoom,
  RecentMatch,
} from "./types";

interface Props {
  user: DashboardUser;
  stats: ProfileStats | null;
  recentMatches: RecentMatch[];
  friends: FriendUser[];
  requests: PendingRequest[];
  rooms: PublicRoom[];
}

export function DashboardShell({ user, stats, recentMatches, friends, requests, rooms }: Props) {
  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            🁫
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Dominó Online</h1>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar>
            {user.image && <AvatarImage src={user.image} alt={user.displayName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Tabs defaultValue="home">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="home">
            <Home className="mr-1 h-4 w-4" /> Inicio
          </TabsTrigger>
          <TabsTrigger value="friends">
            <Users className="mr-1 h-4 w-4" /> Amigos
            {requests.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
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
          <FriendsTab friends={friends} requests={requests} />
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
