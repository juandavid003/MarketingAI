"use client";

import { useActionState } from "react";
import { uploadAndProcessVideo, type UploadVideoState } from "../../video-actions";

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
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-white dark:file:text-black"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      {pending && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Subiendo y procesando tu video (transcripción + edición). Esto puede tardar uno o dos minutos — no cierres esta pestaña.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {pending ? "Procesando..." : "Subir y editar con IA"}
      </button>
    </form>
  );
}
