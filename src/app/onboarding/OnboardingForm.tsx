"use client";

import { useActionState } from "react";
import { createBusiness, type OnboardingState } from "./actions";
import { INDUSTRIES, OBJECTIVES } from "@/lib/constants";

const initialState: OnboardingState = {};

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    createBusiness,
    initialState
  );

  return (
    <form action={formAction} className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Información básica</h2>

        <Field label="Nombre del negocio" htmlFor="name">
          <input
            id="name"
            name="name"
            required
            placeholder="Clínica Dental Sonrisa"
            className={inputClass}
          />
        </Field>

        <Field label="Industria" htmlFor="industry">
          <select
            id="industry"
            name="industry"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona una industria
            </option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="¿Qué vendes?"
          htmlFor="description"
          hint="Describe brevemente tu negocio y lo que ofreces."
        >
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="Somos una clínica dental enfocada en estética: blanqueamientos, carillas e implantes."
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Productos y servicios</h2>

        <Field
          label="Productos o servicios principales"
          htmlFor="products"
          hint="Uno por línea."
        >
          <textarea
            id="products"
            name="products"
            required
            rows={4}
            placeholder={"Blanqueamiento dental\nImplantes\nOrtodoncia\nLimpieza dental"}
            className={inputClass}
          />
        </Field>

        <Field
          label="Ticket promedio (opcional)"
          htmlFor="avgTicket"
          hint="En tu moneda local, sin símbolos."
        >
          <input
            id="avgTicket"
            name="avgTicket"
            type="number"
            min="0"
            step="0.01"
            placeholder="150"
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Audiencia y objetivo</h2>

        <Field
          label="¿A quién le vendes?"
          htmlFor="targetAudience"
          hint="Edad, género, intereses, ubicación, etc."
        >
          <textarea
            id="targetAudience"
            name="targetAudience"
            required
            rows={2}
            placeholder="Hombres y mujeres de 22 a 45 años en Quito, interesados en estética dental."
            className={inputClass}
          />
        </Field>

        <Field label="¿Dónde opera tu negocio?" htmlFor="location">
          <input
            id="location"
            name="location"
            required
            placeholder="Quito, Ecuador"
            className={inputClass}
          />
        </Field>

        <Field label="¿Cuál es tu objetivo principal?" htmlFor="objective">
          <select
            id="objective"
            name="objective"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona un objetivo
            </option>
            {OBJECTIVES.map((objective) => (
              <option key={objective.value} value={objective.value}>
                {objective.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-black px-4 py-3 font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {pending ? "Guardando..." : "Crear perfil de negocio"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-black dark:border-neutral-700 dark:focus:border-white";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
}
