import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Users } from "lucide-react";
import { setClientEnabled } from "./actions";

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
    </main>
  );
}
