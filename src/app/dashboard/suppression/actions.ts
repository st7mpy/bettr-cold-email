"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { suppressionList } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function removeFromSuppression(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const email = formData.get("email") as string;
  if (!email) return;

  await db
    .delete(suppressionList)
    .where(and(eq(suppressionList.userId, userId), eq(suppressionList.email, email)));

  revalidatePath("/dashboard/suppression");
}
