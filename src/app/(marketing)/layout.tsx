import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import AuthNav from "./AuthNav";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            Marketing<span className="text-brand">AI</span>
          </Link>
          <AuthNav userEmail={session?.user.email ?? null} />
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-6 py-6 text-sm text-muted">
          <Link href="/privacy" className="hover:text-foreground">
            Política de privacidad
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Condiciones del servicio
          </Link>
        </div>
      </footer>
    </div>
  );
}
