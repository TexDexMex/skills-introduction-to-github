import Link from "next/link";
import { signOut } from "@/app/login/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shares", label: "Shares" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ email }: { email: string }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold text-brand">
            Chiron · Credentials
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-gray-600 hover:text-brand"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-gray-400 sm:inline">{email}</span>
          <form action={signOut}>
            <button className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
