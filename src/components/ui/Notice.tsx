import { cn } from "./cn";

// The one banner for errors, confirmations and warnings — pages and forms
// used to hand-roll the same red/green/amber paragraph each time.

const TONES = {
  success: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
} as const;

export function Notice({
  tone,
  className,
  children,
}: {
  tone: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md px-4 py-3 text-sm", TONES[tone], className)}>
      {children}
    </p>
  );
}
