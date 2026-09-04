"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

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
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending ? "Abriendo..." : "Gestionar suscripción"}
      </button>
    </div>
  );
}
