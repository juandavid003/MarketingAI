import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Volver",
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && <p className="text-sm font-medium text-muted">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-semibold text-balance">{title}</h1>
          {description && <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
