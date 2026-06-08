import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 12);
  const users = [
    { username: "ana", displayName: "Ana García", email: "ana@example.com" },
    { username: "beto", displayName: "Beto López", email: "beto@example.com" },
    { username: "carla", displayName: "Carla Ruiz", email: "carla@example.com" },
    { username: "dario", displayName: "Darío Méndez", email: "dario@example.com" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        passwordHash: password,
        stats: { create: { gamesPlayed: 0, gamesWon: 0, totalPoints: 0 } },
      },
    });
  }

  console.log("Seed completo. Usuarios de prueba (contraseña: password123):");
  users.forEach((u) => console.log(`  - ${u.email}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
