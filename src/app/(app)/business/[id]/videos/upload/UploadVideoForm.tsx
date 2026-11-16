"use client";

import { useActionState } from "react";
import { uploadAndProcessVideo, type UploadVideoState } from "../../video-actions";
import { Button } from "@/components/ui/Button";

const initialState: UploadVideoState = {};

export default function UploadVideoForm({ businessId }: { businessId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadAndProcessVideo.bind(null, businessId),
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="video" className="block text-sm font-medium">
          Video
        </label>
        <input
          id="video"
          name="video"
          type="file"
          accept="video/*"
          required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-foreground"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      {pending && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Subiendo tu video — no cierres esta pestaña hasta que termine la subida. La edición
          con IA sigue después en segundo plano.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Subiendo..." : "Subir y editar con IA"}
      </Button>
    </form>
  );
}
