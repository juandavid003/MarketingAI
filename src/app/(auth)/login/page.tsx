import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/safeNext";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  // Real (DB-backed) check, not the cookie-only one in proxy.ts — see the
  // comment there on why this redirect can't live in proxy.ts without
  // risking a loop with a stale cookie.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(next ?? "/start");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Inicia sesión</h1>

      <div className="mt-8">
        <LoginForm next={next} />
      </div>

      <div className="mt-6 space-y-2 text-sm text-muted">
        <p>
          <Link href="/forgot-password" className="text-brand hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p>
          ¿No tienes cuenta?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-brand hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
