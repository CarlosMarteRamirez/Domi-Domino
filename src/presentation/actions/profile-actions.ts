"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/infrastructure/auth/auth";
import { updateUserProfile, type UpdateProfileInput } from "@/application/users";

export async function updateProfileAction(input: UpdateProfileInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const result = await updateUserProfile(session.user.id, input);
  revalidatePath("/dashboard");
  return result;
}
