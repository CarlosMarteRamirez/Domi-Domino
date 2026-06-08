"use server";

import { auth } from "@/infrastructure/auth/auth";
import { createInviteLink } from "@/application/invitations";
import { getRoomByCode } from "@/application/rooms";

export async function createInviteLinkAction(code: string, inviteeId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const room = await getRoomByCode(code);
  if (!room) throw new Error("Sala no encontrada");
  return createInviteLink(room.id, session.user.id, inviteeId);
}
