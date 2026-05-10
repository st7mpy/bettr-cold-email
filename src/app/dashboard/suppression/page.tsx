import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { suppressionList } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function SuppressionPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(suppressionList)
    .where(eq(suppressionList.userId, userId))
    .orderBy(desc(suppressionList.createdAt))
    .limit(500);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Suppression list</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        These addresses will never receive a message from any of your campaigns.
        Entries land here automatically when someone clicks unsubscribe, replies
        with a kill-word, or bounces.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No suppressed addresses yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="border-b py-2">Email</th>
              <th className="border-b py-2">Reason</th>
              <th className="border-b py-2">Added</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email}>
                <td className="border-b py-2">{r.email}</td>
                <td className="border-b py-2">{r.reason}</td>
                <td className="border-b py-2 text-muted-foreground">
                  {r.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
