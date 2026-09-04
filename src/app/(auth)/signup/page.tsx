import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/onboarding");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        $100/mes por transferencia. Tu cuenta se activa al confirmar el pago.
      </p>

      <div className="mt-8">
        <SignupForm />
      </div>

      <p className="mt-6 text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
