"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/infrastructure/auth/auth";
import { createRoom, type CreateRoomInput } from "@/application/rooms";

export async function createRoomAction(input: CreateRoomInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const room = await createRoom(session.user.id, input);
  revalidatePath("/dashboard");
  return { code: room.code };
}
