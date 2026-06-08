import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma/client";
import { hashPassword } from "@/infrastructure/auth/password";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, numeros y guion bajo"),
  displayName: z.string().min(2).max(40),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function registerUser(input: RegisterInput) {
  const data = registerSchema.parse(input);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });
  if (existing) {
    throw new Error(
      existing.email === data.email
        ? "Ya existe una cuenta con este email"
        : "Ese nombre de usuario ya esta en uso",
    );
  }

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      username: data.username,
      displayName: data.displayName,
      email: data.email,
      passwordHash,
      stats: { create: {} },
    },
  });

  return { id: user.id, username: user.username };
}

export async function getProfileStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stats: true },
  });
  if (!user) return null;

  const stats = user.stats ?? { gamesPlayed: 0, gamesWon: 0, totalPoints: 0 };
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    image: user.image,
    createdAt: user.createdAt,
    gamesPlayed: stats.gamesPlayed,
    gamesWon: stats.gamesWon,
    totalPoints: stats.totalPoints,
    winRate,
  };
}

export async function getRecentMatches(userId: string, take = 5) {
  const participations = await prisma.matchParticipant.findMany({
    where: { userId, match: { endedAt: { not: null } } },
    include: {
      match: { include: { room: { select: { name: true } } } },
    },
    orderBy: { match: { endedAt: "desc" } },
    take,
  });

  return participations.map((p) => ({
    matchId: p.matchId,
    roomName: p.match.room.name,
    endedAt: p.match.endedAt,
    won: p.match.winnerTeam === p.team,
    finalScore: p.finalScore,
    team: p.team,
  }));
}
