import { redirect } from "next/navigation";
import { getCurrentUserRow } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserRow();
  if (!user) redirect("/sign-in");
  if (!user.postalAddress) redirect("/onboarding");

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-pane" style={{ overflowY: "auto", height: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
