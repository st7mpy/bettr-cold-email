import { redirect } from "next/navigation";
import { saveOnboarding } from "./actions";
import { getCurrentUserRow } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OnboardingPage() {
  const user = await getCurrentUserRow();
  if (!user) redirect("/sign-in");
  if (user.postalAddress) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>One more thing</CardTitle>
          <CardDescription>
            US law (CAN-SPAM) requires your postal address in the footer of every
            email you send. This is shown to recipients only and never to other
            users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOnboarding} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postalAddress">Postal address</Label>
              <Input
                id="postalAddress"
                name="postalAddress"
                placeholder="123 Main St, San Francisco, CA 94102"
                required
                minLength={10}
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
