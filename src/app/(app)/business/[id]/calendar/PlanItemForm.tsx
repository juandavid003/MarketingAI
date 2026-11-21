import { FORMATS, PLAN_PLATFORMS, PLAN_STATUSES, parseDetails, isoDay } from "@/lib/contentPlan";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";

// Label wrapping its control: no ids needed for the association.
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export type PlanItemOptions = {
  campaigns: { id: string; title: string }[];
  pieces: { id: string; hook: string }[];
  links: { id: string; label: string }[];
};

type ItemDefaults = {
  date: Date;
  time: string | null;
  platform: string;
  format: string;
  title: string;
  brief: string | null;
  copy: string | null;
  details: string | null;
  pillar: string | null;
  status: string;
  campaignId: string | null;
  contentPieceId: string | null;
  trackedLinkId: string | null;
  publishedUrl: string | null;
};

// Shared by "add" (calendar page) and "edit" (item page).
export function PlanItemForm({
  action,
  options,
  item,
  defaultDate,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  options: PlanItemOptions;
  item?: ItemDefaults;
  defaultDate?: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <F label="Fecha">
          <Input name="date" type="date" required defaultValue={item ? isoDay(item.date) : defaultDate} />
        </F>
        <F label="Hora (opcional)">
          <Input name="time" type="time" defaultValue={item?.time ?? ""} />
        </F>
        <F label="Red">
          <Select name="platform" defaultValue={item?.platform ?? "instagram"}>
            {PLAN_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </F>
        <F label="Formato">
          <Select name="format" defaultValue={item?.format ?? "reel"}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </F>
      </div>
      <F label="Título">
        <Input name="title" required maxLength={200} defaultValue={item?.title ?? ""} placeholder="Ej. Carrusel: 5 errores al elegir..." />
      </F>
      <F label="Idea / cómo hacerlo">
        <Textarea name="brief" rows={2} defaultValue={item?.brief ?? ""} />
      </F>
      <F label="Texto de la publicación (copy)">
        <Textarea name="copy" rows={3} defaultValue={item?.copy ?? ""} />
      </F>
      <F label="Detalle: una línea por diapositiva, pantalla de historia o momento del reel">
        <Textarea name="details" rows={3} defaultValue={item ? parseDetails(item.details).join("\n") : ""} />
      </F>
      <div className="grid gap-3 sm:grid-cols-3">
        <F label="Estado">
          <Select name="status" defaultValue={item?.status ?? "planned"}>
            {PLAN_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </F>
        <F label="Pilar (opcional)">
          <Input name="pillar" defaultValue={item?.pillar ?? ""} />
        </F>
        <F label="Campaña">
          <Select name="campaignId" defaultValue={item?.campaignId ?? ""}>
            <option value="">Ninguna</option>
            {options.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </F>
        <F label="Guion">
          <Select name="contentPieceId" defaultValue={item?.contentPieceId ?? ""}>
            <option value="">Ninguno</option>
            {options.pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.hook.slice(0, 60)}
              </option>
            ))}
          </Select>
        </F>
        <F label="Enlace rastreable">
          <Select name="trackedLinkId" defaultValue={item?.trackedLinkId ?? ""}>
            <option value="">Ninguno</option>
            {options.links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </F>
        {item && (
          <F label="Enlace de la publicación">
            <Input name="publishedUrl" defaultValue={item.publishedUrl ?? ""} placeholder="https://..." />
          </F>
        )}
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
