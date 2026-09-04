import { cn } from "./cn";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5",
        className
      )}
      {...props}
    />
  );
}
