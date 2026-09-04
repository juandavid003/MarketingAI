import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">MarketingAI</p>
      <h1 className="mt-1 text-2xl font-semibold">Inicia sesión</h1>

      <div className="mt-8">
        <LoginForm />
      </div>

      <div className="mt-6 space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
        <p>
          <Link href="/forgot-password" className="underline text-neutral-800 dark:text-neutral-200">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="underline text-neutral-800 dark:text-neutral-200">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
