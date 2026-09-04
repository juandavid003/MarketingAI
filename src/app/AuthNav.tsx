"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function AuthNav({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();

  if (!userEmail) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/login" className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white">
          Iniciar sesión
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-black px-3 py-1.5 font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Crear cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
      <span className="hidden sm:inline">{userEmail}</span>
      <Link href="/billing" className="hover:text-black dark:hover:text-white">
        Facturación
      </Link>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
        className="hover:text-black dark:hover:text-white"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
