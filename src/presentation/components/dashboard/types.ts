export interface DashboardUser {
  id: string;
  username: string;
  displayName: string;
  image: string | null;
}

export interface ProfileAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
}

export interface ProfileStats {
  id: string;
  username: string;
  displayName: string;
  image: string | null;
  createdAt: Date;
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  winRate: number;
}

export interface RecentMatch {
  matchId: string;
  roomName: string;
  endedAt: string | null;
  won: boolean;
  finalScore: number;
  team: number;
}

export interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  image: string | null;
}

export interface PendingRequest {
  friendshipId: string;
  user: FriendUser;
}

export interface PublicRoom {
  id: string;
  code: string;
  name: string;
  host: { username: string; displayName: string; image: string | null };
  status: "LOBBY" | "IN_GAME" | "FINISHED";
  players: number;
  maxPlayers: number;
  targetScore: number;
  blockMode: "individual" | "parejas";
  passBonus: number;
}
