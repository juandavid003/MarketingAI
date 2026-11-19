import Link from "next/link";
import { headers } from "next/headers";
import { UsersRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { findInvite } from "@/lib/members";
import { Button, LinkButton } from "@/components/ui/Button";
import { acceptInvite } from "./actions";

export const metadata = { title: "Invitación al equipo" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findInvite(token);
  const session = await auth.api.getSession({ headers: await headers() });
  const next = `/invite/${token}`;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <UsersRound className="size-6" />
      </div>
      {!invite || invite.acceptedAt ? (
        <>
          <h1 className="mt-4 text-2xl font-semibold">Invitación no válida</h1>
          <p className="mt-3 text-sm text-muted">
            Este enlace ya se usó o fue anulado. Pide al dueño del negocio que te envíe uno nuevo.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-semibold">Te invitaron a {invite.business.name}</h1>
          <p className="mt-3 text-sm text-muted">
            Como encargado de redes vas a poder crear ideas, guiones y videos, publicar y registrar
            resultados. Las API keys y conexiones las maneja el dueño. No necesitas pagar.
          </p>
          {session ? (
            <form action={acceptInvite.bind(null, token)} className="mt-6 w-full">
              <Button type="submit" className="w-full">
                Aceptar como {session.user.email}
              </Button>
            </form>
          ) : (
            <div className="mt-6 flex w-full flex-col gap-2">
              <LinkButton href={`/signup?next=${encodeURIComponent(next)}`}>Crear cuenta</LinkButton>
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-sm text-brand hover:underline">
                Ya tengo cuenta, iniciar sesión
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
