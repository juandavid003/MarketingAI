"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const newPassword = String(new FormData(e.currentTarget).get("password") ?? "");

    const { error: resetError } = await authClient.resetPassword({ newPassword, token });

    setPending(false);

    if (resetError) {
      setError(resetError.message ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (done) {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
        Contraseña actualizada. Redirigiendo a inicio de sesión...
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <div>
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input id="password" name="password" type="password" required minLength={8} className="mt-1" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  );
}
