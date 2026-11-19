import { cookies } from "next/headers";
import { UsersRound, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { AUDIT_LABEL } from "@/lib/audit";
import { INVITE_FLASH_COOKIE, MAX_MEMBERS_PER_BUSINESS } from "@/lib/members";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Notice, Section } from "@/components/business/sections";
import { LocalTime } from "@/components/LocalTime";
import { inviteMember, removeMember } from "./actions";

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { business, user } = await requireBusinessAccess(id, "manage_members");

  const [members, events] = await Promise.all([
    prisma.businessMember.findMany({
      where: { businessId: id },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditEvent.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  let flash: { email: string; url: string } | null = null;
  try {
    const raw = (await cookies()).get(INVITE_FLASH_COOKIE)?.value;
    flash = raw ? (JSON.parse(raw) as { email: string; url: string }) : null;
  } catch {
    flash = null;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Equipo"
        description="Invita a tu encargado de redes. Puede crear ideas, guiones y videos, publicar y registrar resultados; las API keys, las conexiones y el equipo solo los manejas tú."
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {flash && (
        <Card className="mb-6 p-4 text-sm">
          <p className="font-medium">Invitación lista para {flash.email}</p>
          <p className="mt-1 text-muted">
            Envíale este enlace (por WhatsApp o correo). Solo se muestra unos minutos; si lo pierdes,
            vuelve a invitar al mismo correo y se genera uno nuevo.
          </p>
          <Input readOnly value={flash.url} className="mt-2 font-mono text-xs" />
        </Card>
      )}

      <Section icon={UsersRound} title="Personas con acceso">
        <ul className="divide-y divide-border">
          <li className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>
              {user.email} <span className="text-muted">(tú)</span>
            </span>
            <Badge tone="brand">Dueño</Badge>
          </li>
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                {m.user?.email ?? m.email}
                {m.user && m.user.email.toLowerCase() !== m.email && (
                  <span className="text-xs text-faint"> (invitado como {m.email})</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {m.acceptedAt ? <Badge>Encargado de redes</Badge> : <Badge tone="warning">Invitación pendiente</Badge>}
                <form action={removeMember.bind(null, id, m.id)}>
                  <Button type="submit" size="sm" variant="ghost">
                    {m.acceptedAt ? "Quitar" : "Anular"}
                  </Button>
                </form>
              </span>
            </li>
          ))}
        </ul>

        {members.length < MAX_MEMBERS_PER_BUSINESS && (
          <form action={inviteMember.bind(null, id)} className="mt-4 flex flex-wrap gap-2">
            <Input name="email" type="email" required placeholder="correo@ejemplo.com" className="min-w-48 flex-1" />
            <Button type="submit">Invitar</Button>
          </form>
        )}
      </Section>

      <Section icon={ShieldCheck} title="Actividad sensible" className="mt-10">
        <p className="text-sm text-muted">
          Registro de cambios de API keys, conexiones, publicaciones y equipo en este negocio.
        </p>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin actividad registrada todavía.</p>
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
      </Section>
    </main>
  );
}
