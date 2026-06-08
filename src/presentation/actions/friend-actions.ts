"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/infrastructure/auth/auth";
import {
  searchUsers,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
} from "@/application/friends";

async function userId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function searchUsersAction(query: string) {
  return searchUsers(query, await userId());
}

export async function sendFriendRequestAction(addresseeId: string) {
  await sendFriendRequest(await userId(), addresseeId);
  revalidatePath("/dashboard");
}

export async function respondFriendRequestAction(friendshipId: string, accept: boolean) {
  await respondFriendRequest(await userId(), friendshipId, accept);
  revalidatePath("/dashboard");
}

export async function removeFriendAction(otherUserId: string) {
  await removeFriend(await userId(), otherUserId);
  revalidatePath("/dashboard");
}
