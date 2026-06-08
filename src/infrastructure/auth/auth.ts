import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";

import { prisma } from "@/infrastructure/db/prisma/client";
import { verifyPassword } from "./password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        name: user.displayName,
        email: user.email,
        image: user.image,
        username: user.username,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // username may be present on credentials sign-in; otherwise look it up.
        token.username = (user as { username?: string }).username;
      }
      // Re-read from DB on first login (missing username) or after a profile update.
      if (token.id && (!token.username || trigger === "update")) {
        const db = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (db) {
          token.username = db.username;
          token.picture = db.image ?? null;
          token.name = db.displayName;
          token.email = db.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = (token.username as string) ?? "";
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
