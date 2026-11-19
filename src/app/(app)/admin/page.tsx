import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Users, MessageSquare, ShieldCheck } from "lucide-react";
import { AUDIT_LABEL } from "@/lib/audit";
import { LocalTime } from "@/components/LocalTime";
import { setClientEnabled, markFeedbackRead } from "./actions";

export default async function AdminPage() {
  await requireAdmin();

  const clients = await prisma.user.findMany({
    where: { role: "client" },
    select: {
      id: true,
      name: true,
      email: true,
      enabled: true,
      createdAt: true,
      businesses: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const [feedback, events] = await Promise.all([
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const KIND_LABEL: Record<string, string> = { idea: "Idea", problem: "Problema", praise: "Le gustó" };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title="Clientes"
        description="Habilita el acceso cuando confirmes la transferencia de cada cliente, y deshabilítalo si deja de pagar."
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no hay clientes"
          description="Cuando crees una cuenta para un cliente nuevo desde /signup, va a aparecer aquí."
        />
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card key={client.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{client.name}</p>
                  <Badge tone={client.enabled ? "success" : "warning"}>
                    {client.enabled ? "Habilitado" : "Pendiente"}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">{client.email}</p>
                <p className="mt-1 text-xs text-faint">
                  {client.businesses.length === 0
                    ? "Sin negocio creado todavía"
                    : client.businesses.map((b) => b.name).join(", ")}
                  {" · desde "}
                  {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>

              <form action={setClientEnabled.bind(null, client.id, !client.enabled)}>
                <Button type="submit" variant={client.enabled ? "destructive" : "primary"} size="sm">
                  {client.enabled ? "Deshabilitar" : "Habilitar"}
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-12 flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="size-5" /> Comentarios de los clientes
      </h2>
      {feedback.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay comentarios.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {feedback.map((f) => (
            <Card key={f.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Badge tone={f.kind === "problem" ? "danger" : f.kind === "praise" ? "success" : "brand"}>
                    {KIND_LABEL[f.kind] ?? f.kind}
                  </Badge>
                  {f.status === "new" && <Badge tone="warning">Nuevo</Badge>}
                  <span className="text-muted">{f.userEmail}</span>
                </span>
                <span className="text-xs text-faint">
                  <LocalTime iso={f.createdAt.toISOString()} />
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{f.message}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-faint">
                <span>{f.path}</span>
                {f.status === "new" && (
                  <form action={markFeedbackRead.bind(null, f.id)}>
                    <button type="submit" className="text-brand hover:underline">
                      Marcar como leído
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}

      <h2 className="mt-12 flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="size-5" /> Actividad sensible (todas las cuentas)
      </h2>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sin actividad registrada todavía.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {AUDIT_LABEL[e.action] ?? e.action}
                <span className="text-muted"> · {e.actorEmail ?? "sistema"}</span>
              </span>
              <span className="text-xs text-faint">
                <LocalTime iso={e.createdAt.toISOString()} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
