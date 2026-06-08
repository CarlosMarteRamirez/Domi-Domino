import { requireSession } from "@/presentation/actions/auth";
import { getProfileAccount, getProfileStats, getRecentMatches } from "@/application/users";
import { listFriends, listOutgoingPendingUserIds, listPendingRequests } from "@/application/friends";
import { listPublicRooms } from "@/application/rooms";
import { DashboardShell } from "@/presentation/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [account, stats, recent, friends, requests, outgoingPendingIds, rooms] = await Promise.all([
    getProfileAccount(userId),
    getProfileStats(userId),
    getRecentMatches(userId),
    listFriends(userId),
    listPendingRequests(userId),
    listOutgoingPendingUserIds(userId),
    listPublicRooms(),
  ]);

  const fallbackAccount = {
    id: userId,
    username: session.user.username,
    displayName: session.user.name ?? session.user.username,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
    hasPassword: true,
  };

  return (
    <DashboardShell
      user={{
        id: userId,
        username: account?.username ?? session.user.username,
        displayName: account?.displayName ?? session.user.name ?? session.user.username,
        image: account?.image ?? session.user.image ?? null,
      }}
      account={account ?? fallbackAccount}
      stats={stats}
      recentMatches={recent.map((m) => ({ ...m, endedAt: m.endedAt?.toISOString() ?? null }))}
      friends={friends}
      requests={requests}
      outgoingPendingIds={outgoingPendingIds}
      rooms={rooms}
    />
  );
}
