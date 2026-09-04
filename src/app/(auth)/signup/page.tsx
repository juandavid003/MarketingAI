import Link from "next/link";
import SignupForm from "./SignupForm";

export default function SignupPage() {
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
