import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/dal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
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
      <PageHeader backHref="/onboarding" title="Facturación" />

      <Card>
        {subscription ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">Plan Pro · $100/mes</p>
              <Badge tone={isActive ? "success" : "warning"}>
                {STATUS_LABEL[subscription.status] ?? subscription.status}
              </Badge>
            </div>
            {subscription.periodEnd && (
              <p className="mt-1 text-sm text-muted">
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
            <LinkButton href="/pricing" className="mt-4">
              Suscribirme por $100/mes
            </LinkButton>
          </>
        )}
      </Card>
    </main>
  );
}
