import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  AUTH_GOOGLE_ID: z.string().optional().default(""),
  AUTH_GOOGLE_SECRET: z.string().optional().default(""),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/**
 * Server-side environment. Importing this from client code will throw at build
 * time because the secret values are not exposed to the browser bundle.
 */
function parseServerEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid server environment variables");
  }
  return parsed.data;
}

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (!cachedServerEnv) cachedServerEnv = parseServerEnv();
  return cachedServerEnv;
}

export const isGoogleAuthEnabled = () => {
  const env = serverEnv();
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
};
