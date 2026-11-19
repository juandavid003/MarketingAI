import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/safeNext";
import SignupForm from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(next ?? "/start");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        {next
          ? "Te invitaron a un equipo: crea tu cuenta para aceptar la invitación. No necesitas pagar."
          : "$100/mes por transferencia. Tu cuenta se activa al confirmar el pago."}
      </p>

      <div className="mt-8">
        <SignupForm next={next} />
      </div>

      <p className="mt-6 text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-brand hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
