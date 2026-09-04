import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-sm font-medium text-muted hover:text-foreground">
        ← Marketing<span className="text-brand">AI</span>
      </Link>
      {children}
    </main>
  );
}
