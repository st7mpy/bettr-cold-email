import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Outreach you've launched.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No campaigns yet</CardTitle>
          <CardDescription>
            Connect an email account, then upload your first list of leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled>Coming in Phase 2</Button>
        </CardContent>
      </Card>
    </div>
  );
}
