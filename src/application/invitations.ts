import { prisma } from "@/infrastructure/db/prisma/client";
import { generateToken } from "@/shared/code";
import { clientEnv } from "@/config/env";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export async function createInviteLink(roomId: string, inviterId: string, inviteeId?: string) {
  const token = generateToken();
  const invitation = await prisma.invitation.create({
    data: {
      roomId,
      inviterId,
      inviteeId: inviteeId ?? null,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    include: { room: { select: { code: true } } },
  });

  return {
    id: invitation.id,
    token,
    url: `${clientEnv.NEXT_PUBLIC_APP_URL}/room/${invitation.room.code}?invite=${token}`,
    roomCode: invitation.room.code,
  };
}

export async function listIncomingInvites(userId: string) {
  const invites = await prisma.invitation.findMany({
    where: { inviteeId: userId, expiresAt: { gt: new Date() } },
    include: {
      room: { select: { code: true, name: true } },
      inviter: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return invites;
}
