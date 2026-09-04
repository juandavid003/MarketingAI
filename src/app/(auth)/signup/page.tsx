import Link from "next/link";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">MarketingAI</p>
      <h1 className="mt-1 text-2xl font-semibold">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        $100/mes, cancela cuando quieras.
      </p>

      <div className="mt-8">
        <SignupForm />
      </div>

      <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline text-neutral-800 dark:text-neutral-200">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
