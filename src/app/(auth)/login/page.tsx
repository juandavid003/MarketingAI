import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Inicia sesión</h1>

      <div className="mt-8">
        <LoginForm />
      </div>

      <div className="mt-6 space-y-2 text-sm text-muted">
        <p>
          <Link href="/forgot-password" className="text-brand hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
