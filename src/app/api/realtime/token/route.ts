import { NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { issueSocketToken } from "@/infrastructure/realtime/token";
import { serverEnv } from "@/config/env";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = issueSocketToken(
    { userId: session.user.id, username: session.user.username ?? "" },
    serverEnv().AUTH_SECRET,
  );
  return NextResponse.json({ token });
}
