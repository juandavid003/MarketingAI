import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div>
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">MarketingAI</p>
      <h1 className="mt-1 text-2xl font-semibold">Crea una nueva contraseña</h1>

      <div className="mt-8">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Este enlace no es válido. Solicita uno nuevo desde &ldquo;¿Olvidaste tu
            contraseña?&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
