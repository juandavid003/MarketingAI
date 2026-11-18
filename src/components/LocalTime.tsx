"use client";

import { useSyncExternalStore } from "react";

// Shows an instant in the viewer's own time zone. The server doesn't know
// it, so the server render shows UTC and the browser replaces it.
const subscribe = () => () => {};

export function LocalTime({ iso, withWeekday = false }: { iso: string; withWeekday?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Date(iso).toLocaleString("es", {
        weekday: withWeekday ? "short" : undefined,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    () => `${iso.slice(0, 16).replace("T", " ")} UTC`
  );
  return <time dateTime={iso}>{text}</time>;
}
