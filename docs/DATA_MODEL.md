# Modelo de datos

> Última actualización: 2026-11-16. Fuente de verdad: `prisma/schema.prisma`. Este documento explica el **porqué** y lo planeado.

## Diagrama (actual + Sprint 1–2)

```
User 1─* Business ─┬─1 SocialConnection ─┬─* SocialPage
 (role, enabled)   │                     └─1 MetaAdAccount ❄️
                   ├─* Product
                   ├─* Competitor
                   ├─* Campaign ─┬─* Storyboard
                   │             ├─* CampaignImage
                   │             ├─* PublishedPost
                   │             ├─* AdCampaign ❄️
                   │             ├─* TrackedLink (S2)
                   │             └─* PromoCode   (S2)
                   ├─* VideoAsset ─* VideoVersion ─* PublishedVideo
                   ├─* TrackedLink (S2) ─* LinkClick
                   ├─* PromoCode   (S2)
                   └─* Lead        (S2) ── origen opcional: TrackedLink | PromoCode | Campaign
```
❄️ = modelo de la pauta congelada; se conserva sin uso.

## Entidades actuales

| Modelo | Propósito | Notas |
|---|---|---|
| `User` | Cuenta. `role` = `admin` \| `client`; `enabled` lo controla el admin. | Tabla `user` (Better Auth). |
| `Session`, `Account`, `Verification` | Better Auth. | `Account.issuer` añadido a mano (ver comentario en el schema). |
| `Business` | **Inquilino.** Perfil del negocio + configuración de IA (keys cifradas). | Pertenece a un `User`. |
| `Product` | Productos/servicios del negocio (nombre). | |
| `Competitor` | Competidor registrado (nombre como término de búsqueda). | Sprint 5: usuario de Instagram / página. |
| `SocialConnection` | Conexión OAuth de Meta del negocio (token de usuario de larga duración). | `accessToken` **cifrado** desde Sprint 1. |
| `SocialPage` | Páginas de Facebook (+ cuenta de Instagram vinculada) con su token de página. | `pageAccessToken` **cifrado** desde Sprint 1. |
| `Campaign` | Campaña generada por IA. `content` = JSON (`objetivo, audiencia, concepto, contenido[{hook, formato}], oferta, cta`). | |
| `Storyboard` | Guion escena por escena de una pieza (`contentIndex`). `scenes` = JSON. | |
| `CampaignImage` | Imagen generada para una pieza. `imagePath` = key de almacenamiento. | `provider = placeholder` si no hay key de imágenes (se marca en la UI). |
| `PublishedPost` / `PublishedVideo` | Registro de lo publicado en Facebook (id y permalink). | Base de la analítica por pieza. |
| `VideoAsset` | Video original subido + estado del pipeline + transcripción (JSON). | `status`: uploaded → transcribing → analyzing → rendering → ready \| error. `updatedAt` (S1) detecta trabajos interrumpidos. |
| `VideoVersion` | Clip generado (rango, hook, CTA, archivo, miniatura). | Varias versiones por video (Sprint 4). |
| `MetaAdAccount`, `AdCampaign` | ❄️ Pauta congelada. | No se borran para no perder datos ni migraciones. |

### Rutas de archivos (Sprint 1)
`originalPath`, `outputPath`, `thumbnailPath`, `imagePath` guardan una **key de almacenamiento** (`<businessId>/videos/<id>/original.mp4`). Las filas antiguas guardan `/uploads/...` (público, legado); `lib/storage.ts → fileUrl()` resuelve ambos.

## Sprint 1 — Perfil del negocio ampliado

Columnas nuevas en `Business` (todas opcionales para no romper negocios existentes):

| Campo | Tipo | Módulo |
|---|---|---|
| `subIndustry` | String? | Industria y subindustria |
| `valueProposition` | String? | Propuesta de valor |
| `serviceArea` | String? | Zonas de cobertura |
| `customerPersonas` | String? | Perfiles de cliente ideal (texto libre; estructurado más adelante si hace falta) |
| `brandTone` | String? | Tono de comunicación |
| `brandColors` | String? | Colores (hex separados por coma) — subtítulos/marca en video |
| `contentLanguage` | String @default("es") | Idioma del contenido generado |
| `mainPlatforms` | String[] | Redes principales (`instagram`, `facebook`, `tiktok`, `youtube`) |
| `preferredCtas` | String? | CTAs deseados |
| `websiteUrl`, `whatsapp`, `contactEmail` | String? | Contacto; destinos por defecto de enlaces rastreables |
| `businessGoals` | String? | Objetivos comerciales en texto libre |
| `conversionGoal` | String? | Qué cuenta como conversión ("agendar cita", "compra en tienda") |

`objective` (objetivo de marketing), `avgTicket`, `targetAudience` ya existen.

**Por qué columnas y no una tabla genérica clave-valor:** el perfil es un conjunto conocido y estable; columnas tipadas son más simples de consultar y validar. La configuración **por industria** (A5) sí será datos (tabla o JSON versionado), no columnas.

## Sprint 2 — Leads y conversiones

```prisma
model TrackedLink {
  id             String   @id @default(cuid())
  businessId     String            // inquilino
  campaignId     String?           // opcional: a qué campaña pertenece
  slug           String   @unique  // /r/<slug>
  label          String            // "Bio Instagram - Blanqueamiento"
  destinationUrl String            // WhatsApp, web, formulario
  utmSource      String            // instagram, facebook, qr, tiktok…
  utmMedium      String            // social, qr, video…
  utmCampaign    String
  utmContent     String?
  createdAt      DateTime @default(now())
  clicks         LinkClick[]
}

model LinkClick {            // sin IP ni identificadores personales
  id           String   @id @default(cuid())
  linkId       String
  createdAt    DateTime @default(now())
  referrerHost String?
}

model PromoCode {
  id          String  @id @default(cuid())
  businessId  String
  campaignId  String?
  code        String            // único por negocio
  description String?
  @@unique([businessId, code])
}

model Lead {
  id            String   @id @default(cuid())
  businessId    String
  name          String
  contact       String?
  sourceType    String   // tracked_link | promo_code | declared | unknown
  trackedLinkId String?
  promoCodeId   String?
  campaignId    String?
  sourceNote    String?  // "dijo que vio el reel de blanqueamiento"
  status        String   @default("new") // new | contacted | won | lost
  valueAmount   Float?   // valor de la venta cuando status = won
  notes         String?
  convertedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### Reglas de atribución
- `tracked_link` / `promo_code` → **rastreado**: evidencia verificable.
- `declared` → **declarado**: el cliente lo dijo; se muestra separado.
- `unknown` → sin atribución; cuenta para totales, nunca se asigna a una campaña.
- La UI nunca dice "este video trajo X clientes" salvo con atribución rastreada; para declarados dice "X clientes dicen haber llegado por…".

## Posterior (Sprints 3–6)

| Modelo | Para qué |
|---|---|
| `ContentPlan`, `ContentIdea` | Plan semanal: pilar, propósito, día, formato, hook, estado (idea → guion → grabado → publicado). |
| `PublishJob` | Publicación programada multi-plataforma con estado, intentos y último error. |
| `BusinessMember(role)` ✅ | Encargado de redes por negocio (en vez de `Organization`): invitación por enlace secreto (`tokenHash`), el dueño sigue siendo `Business.userId`. Reglas en `lib/access.ts`. |
| `AuditEvent` ✅ | Quién hizo qué: keys, conexión Meta, publicaciones (también las del programador), activación de cuentas, equipo. Sin FKs para que sobreviva a borrados; nunca guarda secretos. |
| `Feedback` ✅ | Comentarios de los usuarios desde la app; se leen en /admin. |
| `AssistantMessage` ✅ | Conversación con el asistente de crecimiento, por persona y negocio. Cada respuesta guarda los datos numerados (`facts`) que vio, para que sus citas no cambien. |
| ~~`UsageCounter`~~ | No hizo falta: minutos del mes y espacio se calculan al subir (`lib/usageServer.ts`). `VideoAsset.originalDeletedAt` marca originales borrados por la limpieza. |
| `IndustryConfig` | Sugerencias por industria como datos (pilares, CTAs, ejemplos). |
