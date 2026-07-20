import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  return (
    <div className="min-h-screen">
      <Nav email={user.email ?? ""} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
