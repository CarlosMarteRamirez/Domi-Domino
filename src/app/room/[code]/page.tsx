import { notFound } from "next/navigation";
import { requireSession } from "@/presentation/actions/auth";
import { getRoomByCode } from "@/application/rooms";
import { RoomClient } from "@/presentation/components/room/room-client";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await requireSession();
  const room = await getRoomByCode(code);
  if (!room) notFound();

  return <RoomClient code={code} currentUserId={session.user.id} />;
}
