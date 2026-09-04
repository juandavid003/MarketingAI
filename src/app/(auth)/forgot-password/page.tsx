import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">MarketingAI</p>
      <h1 className="mt-1 text-2xl font-semibold">Recupera tu contraseña</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Te enviamos un enlace para crear una nueva.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/login" className="underline text-neutral-800 dark:text-neutral-200">
          ← Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
