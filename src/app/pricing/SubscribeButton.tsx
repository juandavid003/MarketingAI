"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SubscribeButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);

    const { error: checkoutError } = await authClient.subscription.upgrade({
      plan: "pro",
      successUrl: "/onboarding",
      cancelUrl: "/pricing",
    });

    setPending(false);
    if (checkoutError) {
      setError(checkoutError.message ?? "No se pudo iniciar el pago.");
    }
    // On success, Stripe Checkout handles the redirect itself.
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
        className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {pending ? "Redirigiendo a Stripe..." : "Suscribirme"}
      </button>
    </div>
  );
}
