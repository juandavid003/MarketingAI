import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Recupera tu contraseña</h1>
      <p className="mt-2 text-sm text-muted">Te enviamos un enlace para crear una nueva.</p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="text-brand hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
