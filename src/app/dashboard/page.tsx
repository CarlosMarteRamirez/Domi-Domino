import { requireSession } from "@/presentation/actions/auth";
import { getProfileStats, getRecentMatches } from "@/application/users";
import { listFriends, listPendingRequests } from "@/application/friends";
import { listPublicRooms } from "@/application/rooms";
import { DashboardShell } from "@/presentation/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [stats, recent, friends, requests, rooms] = await Promise.all([
    getProfileStats(userId),
    getRecentMatches(userId),
    listFriends(userId),
    listPendingRequests(userId),
    listPublicRooms(),
  ]);

  return (
    <DashboardShell
      user={{
        id: userId,
        username: session.user.username,
        displayName: session.user.name ?? session.user.username,
        image: session.user.image ?? null,
      }}
      stats={stats}
      recentMatches={recent.map((m) => ({ ...m, endedAt: m.endedAt?.toISOString() ?? null }))}
      friends={friends}
      requests={requests}
      rooms={rooms}
    />
  );
}
