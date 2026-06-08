import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma/client";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";

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

export async function getProfileAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    image: user.image,
    hasPassword: Boolean(user.passwordHash),
  };
}

export const updateProfileSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, numeros y guion bajo"),
    displayName: z.string().min(2).max(40),
    email: z.string().email(),
    image: z
      .string()
      .url("Debe ser una URL valida")
      .max(500)
      .optional()
      .or(z.literal("")),
    currentPassword: z.string().optional().or(z.literal("")),
    newPassword: z.string().min(8).max(72).optional().or(z.literal("")),
  })
  .refine((d) => !d.newPassword || Boolean(d.currentPassword), {
    message: "Indica tu contraseña actual para cambiarla",
    path: ["currentPassword"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const data = updateProfileSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuario no encontrado");

  // username/email must remain unique across other users.
  const clash = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [{ email: data.email }, { username: data.username }],
    },
  });
  if (clash) {
    throw new Error(
      clash.email === data.email
        ? "Ese email ya está en uso por otra cuenta"
        : "Ese nombre de usuario ya está en uso",
    );
  }

  let passwordHash: string | undefined;
  if (data.newPassword) {
    if (!user.passwordHash) {
      // Account created via OAuth without a password: allow setting one.
      passwordHash = await hashPassword(data.newPassword);
    } else {
      const valid = await verifyPassword(data.currentPassword ?? "", user.passwordHash);
      if (!valid) throw new Error("La contraseña actual es incorrecta");
      passwordHash = await hashPassword(data.newPassword);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      username: data.username,
      displayName: data.displayName,
      email: data.email,
      image: data.image ? data.image : null,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  return {
    id: updated.id,
    username: updated.username,
    displayName: updated.displayName,
    email: updated.email,
    image: updated.image,
  };
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
