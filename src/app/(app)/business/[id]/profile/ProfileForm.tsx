"use client";

import { useActionState } from "react";
import { updateBusinessProfile, type ProfileFormState } from "./actions";
import { INDUSTRIES, OBJECTIVES, PLATFORMS, CONTENT_LANGUAGES } from "@/lib/constants";
import { Input, Select, Textarea, FormField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export type ProfileFormValues = {
  name: string;
  industry: string;
  subIndustry: string;
  description: string;
  products: string;
  avgTicket: string;
  valueProposition: string;
  targetAudience: string;
  customerPersonas: string;
  location: string;
  serviceArea: string;
  objective: string;
  businessGoals: string;
  conversionGoal: string;
  brandTone: string;
  brandColors: string;
  contentLanguage: string;
  mainPlatforms: string[];
  preferredCtas: string;
  websiteUrl: string;
  whatsapp: string;
  contactEmail: string;
};

const initialState: ProfileFormState = {};

export default function ProfileForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: ProfileFormValues;
}) {
  const [state, formAction, pending] = useActionState(
    updateBusinessProfile.bind(null, businessId),
    initialState
  );

  // Keep a business's existing industry selectable even if it's no longer in
  // the suggested list (the list is a suggestion, not a constraint).
  const industries: string[] = INDUSTRIES.includes(initial.industry as (typeof INDUSTRIES)[number])
    ? [...INDUSTRIES]
    : [initial.industry, ...INDUSTRIES];

  return (
    <form action={formAction} className="space-y-10">
      <Section title="Negocio">
        <FormField label="Nombre del negocio" htmlFor="name">
          <Input id="name" name="name" required defaultValue={initial.name} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Industria" htmlFor="industry">
            <Select id="industry" name="industry" required defaultValue={initial.industry}>
              {industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Especialidad / subindustria" htmlFor="subIndustry" hint="Ej. ortodoncia, comida vegana, crossfit.">
            <Input id="subIndustry" name="subIndustry" defaultValue={initial.subIndustry} />
          </FormField>
        </div>
        <FormField label="¿Qué vendes?" htmlFor="description">
          <Textarea id="description" name="description" required rows={3} defaultValue={initial.description} />
        </FormField>
        <FormField label="Propuesta de valor" htmlFor="valueProposition" hint="¿Por qué te eligen a ti y no a la competencia?">
          <Textarea id="valueProposition" name="valueProposition" rows={2} defaultValue={initial.valueProposition} />
        </FormField>
      </Section>

      <Section title="Productos y servicios">
        <FormField label="Productos o servicios principales" htmlFor="products" hint="Uno por línea.">
          <Textarea id="products" name="products" required rows={4} defaultValue={initial.products} />
        </FormField>
        <FormField label="Ticket promedio" htmlFor="avgTicket" hint="Valor promedio de una venta, en tu moneda, sin símbolos. Se usa para estimar ingresos de tus leads.">
          <Input id="avgTicket" name="avgTicket" type="number" min="0" step="0.01" defaultValue={initial.avgTicket} />
        </FormField>
      </Section>

      <Section title="Clientes y mercado">
        <FormField label="Público objetivo" htmlFor="targetAudience">
          <Textarea id="targetAudience" name="targetAudience" required rows={2} defaultValue={initial.targetAudience} />
        </FormField>
        <FormField
          label="Perfiles de cliente ideal"
          htmlFor="customerPersonas"
          hint="Describe 1–3 tipos de cliente: quién es, qué le preocupa, qué lo hace decidirse."
        >
          <Textarea id="customerPersonas" name="customerPersonas" rows={4} defaultValue={initial.customerPersonas} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Ubicación" htmlFor="location">
            <Input id="location" name="location" required defaultValue={initial.location} />
          </FormField>
          <FormField label="Zonas de cobertura" htmlFor="serviceArea" hint="Barrios, ciudades o 'envíos a todo el país'.">
            <Input id="serviceArea" name="serviceArea" defaultValue={initial.serviceArea} />
          </FormField>
        </div>
      </Section>

      <Section title="Objetivos">
        <FormField label="Objetivo de marketing" htmlFor="objective">
          <Select id="objective" name="objective" required defaultValue={initial.objective}>
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Objetivos comerciales" htmlFor="businessGoals" hint="Ej. 20 pacientes nuevos al mes, vender 100 menús ejecutivos por semana.">
          <Textarea id="businessGoals" name="businessGoals" rows={2} defaultValue={initial.businessGoals} />
        </FormField>
        <FormField label="¿Qué cuenta como conversión?" htmlFor="conversionGoal" hint="Ej. agendar una cita, escribir por WhatsApp, comprar en la tienda.">
          <Input id="conversionGoal" name="conversionGoal" defaultValue={initial.conversionGoal} />
        </FormField>
      </Section>

      <Section title="Marca y contenido">
        <FormField label="Tono de comunicación" htmlFor="brandTone" hint="Ej. cercano y divertido, profesional y confiable.">
          <Input id="brandTone" name="brandTone" defaultValue={initial.brandTone} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Colores de la marca" htmlFor="brandColors" hint="Códigos hex separados por coma, ej. #0EA5E9, #111827.">
            <Input id="brandColors" name="brandColors" defaultValue={initial.brandColors} />
          </FormField>
          <FormField label="Idioma del contenido" htmlFor="contentLanguage">
            <Select id="contentLanguage" name="contentLanguage" defaultValue={initial.contentLanguage}>
              {CONTENT_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label[0].toUpperCase() + l.label.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Redes principales</legend>
          <div className="flex flex-wrap gap-4">
            {PLATFORMS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="mainPlatforms"
                  value={p.value}
                  defaultChecked={initial.mainPlatforms.includes(p.value)}
                  className="size-4 accent-brand"
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="Llamadas a la acción preferidas" htmlFor="preferredCtas" hint="Ej. 'Escríbenos por WhatsApp', 'Agenda tu evaluación gratis'.">
          <Textarea id="preferredCtas" name="preferredCtas" rows={2} defaultValue={initial.preferredCtas} />
        </FormField>
      </Section>

      <Section title="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="WhatsApp" htmlFor="whatsapp" hint="Con código de país, ej. +593 99 123 4567.">
            <Input id="whatsapp" name="whatsapp" type="tel" defaultValue={initial.whatsapp} />
          </FormField>
          <FormField label="Email de contacto" htmlFor="contactEmail">
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={initial.contactEmail} />
          </FormField>
        </div>
        <FormField label="Sitio web" htmlFor="websiteUrl">
          <Input id="websiteUrl" name="websiteUrl" defaultValue={initial.websiteUrl} placeholder="https://" />
        </FormField>
      </Section>

      {state.error && (
        <Notice tone="danger">
          {state.error}
        </Notice>
      )}
      {state.success && !pending && (
        <Notice tone="success">
          Perfil guardado.
        </Notice>
      )}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "Guardando..." : "Guardar perfil"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
