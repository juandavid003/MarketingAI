import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { Clock } from "lucide-react";

export default async function PendingPage() {
  const user = await requireUser();
  if (user.role === "admin" || user.enabled) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Clock className="size-6" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Tu cuenta está pendiente de activación</h1>
      <p className="mt-3 text-sm text-muted">
        Te contactaremos para confirmar el pago. En cuanto se active tu cuenta vas a poder
        entrar aquí mismo, sin hacer nada más.
      </p>
    </main>
  );
}
