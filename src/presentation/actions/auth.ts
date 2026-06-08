import { auth } from "@/infrastructure/auth/auth";
import { redirect } from "next/navigation";

/** Returns the authenticated session or redirects to /login. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}
