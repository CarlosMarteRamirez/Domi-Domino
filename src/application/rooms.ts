import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma/client";
import { generateRoomCode } from "@/shared/code";
import { Prisma } from "@prisma/client";

export const createRoomSchema = z.object({
  name: z.string().min(3).max(40),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  maxPlayers: z.union([z.literal(2), z.literal(4)]),
  targetScore: z.union([z.literal(100), z.literal(200), z.literal(400), z.literal(500)]),
  blockMode: z.enum(["individual", "parejas"]),
  passBonus: z.union([z.literal(0), z.literal(25), z.literal(30)]),
  teamSelection: z.enum(["manual", "auto"]),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export async function createRoom(hostId: string, input: CreateRoomInput) {
  const data = createRoomSchema.parse(input);

  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.room.findUnique({ where: { code } });
    if (!clash) break;
    code = generateRoomCode();
  }

  const room = await prisma.room.create({
    data: {
      code,
      name: data.name,
      hostId,
      visibility: data.visibility,
      maxPlayers: data.maxPlayers,
      targetScore: data.targetScore,
      blockMode: data.blockMode,
      passBonus: data.passBonus,
      teamSelection: data.teamSelection,
      members: { create: { userId: hostId, seat: 0, team: 0 } },
    },
  });

  return room;
}

export interface PublicRoomFilters {
  targetScore?: number;
  maxPlayers?: number;
  blockMode?: "individual" | "parejas";
}

export async function listPublicRooms(filters: PublicRoomFilters = {}) {
  const where: Prisma.RoomWhereInput = {
    visibility: "PUBLIC",
    status: { in: ["LOBBY", "IN_GAME"] },
  };
  if (filters.targetScore) where.targetScore = filters.targetScore;
  if (filters.maxPlayers) where.maxPlayers = filters.maxPlayers;
  if (filters.blockMode) where.blockMode = filters.blockMode;

  const rooms = await prisma.room.findMany({
    where,
    include: {
      host: { select: { username: true, displayName: true, image: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rooms.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    host: r.host,
    status: r.status,
    players: r._count.members,
    maxPlayers: r.maxPlayers,
    targetScore: r.targetScore,
    blockMode: r.blockMode,
    passBonus: r.passBonus,
  }));
}

export async function getRoomByCode(code: string) {
  return prisma.room.findUnique({
    where: { code },
    include: {
      host: { select: { id: true, username: true, displayName: true, image: true } },
      members: {
        include: { user: { select: { id: true, username: true, displayName: true, image: true } } },
        orderBy: { seat: "asc" },
      },
    },
  });
}
