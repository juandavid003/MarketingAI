import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/dal";
import ManageSubscriptionButton from "./ManageSubscriptionButton";

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  unpaid: "Sin pagar",
};

export default async function BillingPage() {
  const user = await requireUser();

  const subscriptions = await auth.api.listActiveSubscriptions({
    query: { referenceId: user.id },
    headers: await headers(),
  });
  const subscription = subscriptions[0] ?? null;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/onboarding"
        className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← Volver
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Facturación</h1>

      <div className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        {subscription ? (
          <>
            <p className="font-medium">
              Plan Pro · $100/mes ·{" "}
              <span className={isActive ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>
                {STATUS_LABEL[subscription.status] ?? subscription.status}
              </span>
            </p>
            {subscription.periodEnd && (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {subscription.cancelAtPeriodEnd ? "Se cancela el" : "Se renueva el"}{" "}
                {new Date(subscription.periodEnd).toLocaleDateString()}
              </p>
            )}
            <div className="mt-4">
              <ManageSubscriptionButton />
            </div>
          </>
        ) : (
          <>
            <p className="font-medium">No tienes una suscripción activa</p>
            <Link
              href="/pricing"
              className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Suscribirme por $100/mes
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
