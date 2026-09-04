"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function SignupForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { error: signupError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setPending(false);

    if (signupError) {
      setError(signupError.message ?? "No se pudo crear la cuenta.");
      return;
    }

    router.push("/pricing");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" type="text" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required minLength={8} className="mt-1" />
        <p className="mt-1 text-xs text-muted">Mínimo 8 caracteres.</p>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
    </form>
  );
}
