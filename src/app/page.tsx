import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-6 text-center">
        <h1 className="text-5xl font-bold">Bettr Cold Email</h1>
        <p className="text-lg text-muted-foreground">
          AI cold email, grounded in real research.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
