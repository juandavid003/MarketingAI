"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const email = String(new FormData(e.currentTarget).get("email") ?? "");

    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    setPending(false);

    if (requestError) {
      setError(requestError.message ?? "No se pudo enviar el correo.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
        Si esa cuenta existe, te enviamos un correo con instrucciones.
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
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Enviar enlace"}
      </Button>
    </form>
  );
}
