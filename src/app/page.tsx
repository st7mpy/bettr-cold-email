import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold">Relay</h1>
        <p className="text-muted-foreground">AI cold email, grounded.</p>
        <Button>Get started</Button>
      </div>
    </main>
  );
}
