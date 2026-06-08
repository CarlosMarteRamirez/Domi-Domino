import { prisma } from "@/infrastructure/db/prisma/client";
import { FriendshipStatus } from "@prisma/client";

export async function searchUsers(query: string, excludeUserId: string) {
  if (query.trim().length < 2) return [];
  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, displayName: true, image: true },
    take: 10,
  });
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  if (requesterId === addresseeId) throw new Error("No puedes agregarte a ti mismo");

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    },
  });
  if (existing) {
    if (existing.status === "ACCEPTED") throw new Error("Ya son amigos");
    if (existing.status === "PENDING") throw new Error("Ya hay una solicitud pendiente");
  }

  return prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId, addresseeId } },
    create: { requesterId, addresseeId, status: "PENDING" },
    update: { status: "PENDING" },
  });
}

export async function respondFriendRequest(
  userId: string,
  friendshipId: string,
  accept: boolean,
) {
  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!friendship || friendship.addresseeId !== userId) {
    throw new Error("Solicitud no encontrada");
  }
  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? FriendshipStatus.ACCEPTED : FriendshipStatus.REJECTED },
  });
}

export async function removeFriend(userId: string, otherUserId: string) {
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
  });
}

export async function listFriends(userId: string) {
  const accepted = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true, image: true } },
      addressee: { select: { id: true, username: true, displayName: true, image: true } },
    },
  });

  return accepted.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
}

export async function listPendingRequests(userId: string) {
  const requests = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    include: {
      requester: { select: { id: true, username: true, displayName: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return requests.map((r) => ({ friendshipId: r.id, user: r.requester }));
}
