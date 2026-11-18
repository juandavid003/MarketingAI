"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button, LinkButton } from "@/components/ui/Button";

export default function AuthNav({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();

  if (!userEmail) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/login" className="text-muted hover:text-foreground">
          Iniciar sesión
        </Link>
        <LinkButton href="/signup" size="sm">
          Crear cuenta
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/start" className="hidden text-muted hover:text-foreground sm:inline">
        Mi cuenta
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
