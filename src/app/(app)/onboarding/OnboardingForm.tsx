"use client";

import { useActionState } from "react";
import { createBusiness, type OnboardingState } from "./actions";
import { INDUSTRIES, OBJECTIVES } from "@/lib/constants";
import { Input, Select, Textarea, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const initialState: OnboardingState = {};

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusiness, initialState);

  return (
    <form action={formAction} className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Información básica</h2>

        <Field label="Nombre del negocio" htmlFor="name">
          <Input id="name" name="name" required placeholder="Clínica Dental Sonrisa" />
        </Field>

        <Field label="Industria" htmlFor="industry">
          <Select id="industry" name="industry" required defaultValue="">
            <option value="" disabled>
              Selecciona una industria
            </option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="¿Qué vendes?" htmlFor="description" hint="Describe brevemente tu negocio y lo que ofreces.">
          <Textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="Somos una clínica dental enfocada en estética: blanqueamientos, carillas e implantes."
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Productos y servicios</h2>

        <Field label="Productos o servicios principales" htmlFor="products" hint="Uno por línea.">
          <Textarea
            id="products"
            name="products"
            required
            rows={4}
            placeholder={"Blanqueamiento dental\nImplantes\nOrtodoncia\nLimpieza dental"}
          />
        </Field>

        <Field label="Ticket promedio (opcional)" htmlFor="avgTicket" hint="En tu moneda local, sin símbolos.">
          <Input id="avgTicket" name="avgTicket" type="number" min="0" step="0.01" placeholder="150" />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Audiencia y objetivo</h2>

        <Field label="¿A quién le vendes?" htmlFor="targetAudience" hint="Edad, género, intereses, ubicación, etc.">
          <Textarea
            id="targetAudience"
            name="targetAudience"
            required
            rows={2}
            placeholder="Hombres y mujeres de 22 a 45 años en Quito, interesados en estética dental."
          />
        </Field>

        <Field label="¿Dónde opera tu negocio?" htmlFor="location">
          <Input id="location" name="location" required placeholder="Quito, Ecuador" />
        </Field>

        <Field label="¿Cuál es tu objetivo principal?" htmlFor="objective">
          <Select id="objective" name="objective" required defaultValue="">
            <option value="" disabled>
              Selecciona un objetivo
            </option>
            {OBJECTIVES.map((objective) => (
              <option key={objective.value} value={objective.value}>
                {objective.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      {state.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "Guardando..." : "Crear perfil de negocio"}
      </Button>
    </form>
  );
}

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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
