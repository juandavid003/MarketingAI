import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { can } from "@/lib/access";
import { ADS_ENABLED } from "@/lib/features";
import { decryptToken } from "@/lib/crypto";
import { fetchAdAccounts, type AdAccount } from "@/lib/meta";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice, ConnectionCard, AdAccountCard, AiSettingsCard, OwnerOnlyNotice } from "@/components/business/sections";

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connected?: string; meta_error?: string; ad_error?: string }>;
}) {
  const { id } = await params;
  const { connected, meta_error: metaError, ad_error: adError } = await searchParams;
  const { business, role } = await requireBusinessAccess(id);
  if (!can(role, "manage_connections")) {
    return <OwnerOnlyNotice title="Conexiones" what="La conexión con Facebook e Instagram" />;
  }
  const connection = await prisma.socialConnection.findUnique({
    where: { businessId: id },
    include: { pages: true, adAccount: true },
  });

  let availableAdAccounts: AdAccount[] = [];
  let adAccountsError: string | null = null;
  if (ADS_ENABLED && connection && !connection.adAccount) {
    try {
      availableAdAccounts = await fetchAdAccounts(decryptToken(connection.accessToken));
    } catch (err) {
      adAccountsError = err instanceof Error ? err.message : "No se pudieron leer las cuentas publicitarias.";
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <PageHeader
        eyebrow={business.name}
        title="Conexiones"
        description={`Cuentas conectadas a ${business.name}. Cada negocio tiene sus propias conexiones.`}
      />
      <div className="space-y-2">
        {connected === "1" && <Notice tone="success">Conectaste tu cuenta de Meta correctamente.</Notice>}
        {metaError && <Notice tone="danger">No se pudo conectar con Meta: {metaError}</Notice>}
        {adError && <Notice tone="danger">{adError}</Notice>}
      </div>
      <div className="mt-4 space-y-4">
        <ConnectionCard business={{ id, socialConnection: connection }} />
        {ADS_ENABLED && connection && (
          <AdAccountCard
            businessId={id}
            adAccount={connection.adAccount}
            availableAccounts={availableAdAccounts}
            error={adAccountsError}
          />
        )}
        <AiSettingsCard businessId={id} provider={business.aiProvider} />
      </div>
    </main>
  );
}
