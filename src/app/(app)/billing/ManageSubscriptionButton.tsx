"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";

export default function ManageSubscriptionButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);
    const { error: portalError } = await authClient.subscription.billingPortal({
      returnUrl: "/billing",
    });
    setPending(false);
    if (portalError) {
      setError(portalError.message ?? "No se pudo abrir el portal de facturación.");
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <Button type="button" variant="secondary" onClick={handleClick} disabled={pending}>
        {pending ? "Abriendo..." : "Gestionar suscripción"}
      </Button>
    </div>
  );
}
