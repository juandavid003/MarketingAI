"use client";

import { useState, useSyncExternalStore } from "react";
import { Input } from "@/components/ui/Field";

const subscribe = () => () => {};

// "Ahora" or a local date/time. The browser's time-zone offset travels with
// the form so the server can turn the local time into UTC.
export function WhenField({ defaultAt }: { defaultAt: string }) {
  const [mode, setMode] = useState<"now" | "later">(defaultAt ? "later" : "now");
  const offset = useSyncExternalStore(subscribe, () => String(new Date().getTimezoneOffset()), () => "0");
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="mb-1 font-medium">Cuándo</legend>
      <input type="hidden" name="tzOffset" value={offset} />
      <label className="flex items-center gap-2">
        <input type="radio" name="when" value="now" checked={mode === "now"} onChange={() => setMode("now")} />
        Ahora
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <input type="radio" name="when" value="later" checked={mode === "later"} onChange={() => setMode("later")} />
        Programar para
        <Input
          type="datetime-local"
          name="at"
          defaultValue={defaultAt}
          required={mode === "later"}
          disabled={mode === "now"}
          className="w-auto"
        />
      </label>
    </fieldset>
  );
}
