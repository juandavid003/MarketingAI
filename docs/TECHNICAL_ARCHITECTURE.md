# Arquitectura técnica

> Última actualización: 2026-11-16.

## Resumen

**Un monolito Next.js** (App Router, Server Components y Server Actions) desplegado en **un droplet de DigitalOcean** (USD 12/mes) con Docker Compose: app (Node + ffmpeg), **PostgreSQL** y Caddy (HTTPS). Detalle operativo en [deploy/README.md](../deploy/README.md). Decisión 2026-11-16: migración desde Railway + Prisma Postgres por costo. Sin microservicios.

```
                 ┌───────────────────────── Droplet DigitalOcean (Docker)────────────────────────┐
 Navegador ────► │ Next.js 16                                                                    │
                 │  ├─ proxy.ts (chequeo optimista de cookie)                                    │
                 │  ├─ app/(marketing) (auth) (app)  ── Server Components + Server Actions      │
                 │  ├─ app/api/auth/*      Better Auth + OAuth de Meta                           │
                 │  ├─ app/api/files/*     sirve archivos privados tras verificar el negocio     │
                 │  ├─ app/r/[slug]        redirección de enlaces rastreables (Sprint 2)         │
                 │  ├─ lib/dal.ts          autorización cerca de los datos                       │
                 │  ├─ lib/jobs/*          trabajos en segundo plano (video)                     │
                 │  ├─ lib/storage.ts      almacenamiento de archivos (volumen → R2 a futuro)    │
                 │  └─ ffmpeg / ffprobe                                                           │
                 │                       Volumen persistente  /data/storage                      │
                 └───────────────┬───────────────────────────────────────────────┬──────────────┘
                                 │                                               │
                    PostgreSQL (contenedor)                      APIs externas (con credenciales
                                                                 del cliente o de la app):
                                                                 Meta Graph, Anthropic, OpenAI,
                                                                 (Google Gemini — planeado)
```

## Decisiones y su porqué

### 1. Monolito Next.js en un droplet (no serverless)
- **Por qué:** el procesamiento de video necesita ffmpeg, disco y procesos de minutos. Un servidor Node persistente lo permite sin colas externas. Un solo despliegue, un solo repositorio, un solo lenguaje.
- **Costo:** escalar el render de video escala también la web. Aceptable hasta decenas de clientes.
- **Salida futura:** separar un contenedor "worker" con el mismo código (`npm run worker`) cuando el video compita con la web por CPU.

### 2. Postgres + Prisma 7
- Prisma con `@prisma/adapter-pg`; cliente generado en `src/generated/prisma`.
- Postgres corre en el mismo droplet (contenedor `db`, no expuesto a internet), con respaldo diario (`deploy/backup.sh`).
- Migraciones en `prisma/migrations`, aplicadas en el arranque (`prisma migrate deploy` en `npm start`).
- **Regla:** las migraciones se generan como SQL revisable y se aplican en el despliegue — nunca contra la base de producción desde una máquina local.

### 3. Autenticación y autorización
- **Better Auth** (email + contraseña, sesiones en BD).
- `proxy.ts` solo hace un chequeo optimista de cookie. **La autorización real** está en `lib/dal.ts`:
  - `requireUser` → sesión válida.
  - `requireEnabledAccount` → cuenta habilitada por el admin.
  - `requireAdmin`.
  - `requireBusinessAccess(businessId)` → **toda** página o acción de un negocio la llama primero.
- Registros hijos (campañas, videos, páginas…) se validan contra su `businessId` en cada acción.

### 4. Multi-tenancy
- **Hoy:** el inquilino es el `Business`; cada `Business` pertenece a un `User`. Aislamiento a nivel de aplicación (filtro por `businessId`).
- **Sprint 6:** `Organization` + `Membership(role)` para que un encargado de redes acceda a negocios ajenos con rol `editor`. `requireBusinessAccess` es el único punto a cambiar.
- **No** usamos Row-Level Security de Postgres todavía: agrega complejidad operativa; las pruebas de aislamiento cubren el riesgo.

### 5. Proveedores de IA (cliente trae su key)
- Decisión 2026-11-16: **cada cliente paga su IA**. Keys cifradas por negocio (`aiApiKeyEncrypted`, etc.).
- `lib/ai.ts` abstrae el proveedor (`anthropic` | `openai`; `google` planeado) con `callProvider()`. Toda generación devuelve JSON validado.
- **Contexto del negocio único** (`lib/businessContext.ts`, Sprint 1): una sola función arma el bloque de contexto (perfil completo) que usan todos los prompts.
- **Video:** transcripción con OpenAI Whisper (`lib/whisper.ts`); análisis por transcripción. Spike planeado con **Gemini** (análisis visual del video completo) para detectar momentos y motivos para regrabar.

### 6. Almacenamiento de archivos
- **Antes:** `public/uploads` → público para cualquiera con el link y **se borraba en cada despliegue**.
- **Ahora (Sprint 1):** `lib/storage.ts` con un driver de disco local en `STORAGE_DIR` (fuera de `public/`). En producción, `STORAGE_DIR=/data/storage` en un **volumen Docker persistente** del droplet. Los archivos se sirven por `/api/files/<key>`, que verifica que el usuario tenga acceso al negocio dueño del archivo (la key empieza con el `businessId`).
- **Futuro:** driver S3-compatible (Cloudflare R2: sin costo de salida) con URLs firmadas, sin cambiar a quienes llaman a `storage`.

### 7. Trabajos en segundo plano
- **Sprint 1:** el upload guarda el archivo, crea el `VideoAsset` y programa el procesamiento con `after()` de Next.js (corre después de enviar la respuesta, en el mismo proceso). El estado vive en la BD; la página se refresca sola.
- **Resiliencia:** si el proceso se reinicia a mitad de camino, el video queda en un estado intermedio; pasados 30 min la UI ofrece **Reintentar** (idempotente: rehace desde el original).
- **Límite conocido:** un reinicio pierde el trabajo en curso (se reintenta a mano) y no hay control de concurrencia. **Siguiente paso** cuando haya volumen: cola en Postgres (p. ej. pg-boss) + servicio worker separado. Sin Redis.

### 8. Secretos
- Variables de entorno para credenciales de la app (`META_APP_SECRET`, `BETTER_AUTH_SECRET`, `ENCRYPTION_SECRET`, …). `.env*` en `.gitignore`.
- Secretos de clientes (keys de IA, **tokens de Meta**) cifrados con AES-256-GCM (`lib/crypto.ts`). Los tokens antiguos en texto plano se leen de forma compatible y se recifran al refrescarse.

### 9. Feature flags
- `lib/features.ts`. Hoy: `FEATURE_ADS` (pauta congelada, apagada por defecto).

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Auth |
| `ENCRYPTION_SECRET` | Cifrado de secretos de clientes. **Cambiarla invalida todo lo cifrado.** |
| `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_VERSION` | OAuth y Graph API de Meta |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Opcional; si no, usa los del PATH |
| `STORAGE_DIR` | Carpeta de archivos privados. Local: `./storage`. Producción: `/data/storage` (volumen `appdata`). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correo transaccional (opcional) |
| `FEATURE_ADS` | `true` reactiva la pauta |
| `META_REQUEST_IG_INSIGHTS` | `true` pide `instagram_manage_insights` en el login de Meta (Business Discovery de competidores). Activar solo después de habilitarlo en el panel de la app. |

## Riesgos técnicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Meta App Review rechazado/lento | Sin publicar en cuentas de terceros | Funciona con usuarios con rol en la app mientras tanto; pedir solo permisos necesarios (sin `ads_management`). |
| Ad Library API no cubre anuncios comerciales fuera de UE | Módulo de competencia vacío en LatAm | Pasar a Instagram Business Discovery (orgánico) y explicar la limitación en la UI. |
| Video procesado en el proceso web | Lentitud de la web durante renders; trabajos perdidos en reinicios | Reintento; worker separado + cola en Postgres cuando haga falta. |
| Disco del droplet lleno (50 GB) | Subidas fallan | Límite de tamaño por archivo; borrar originales tras N días (Sprint 6); migrar a R2. |
| Cliente pega una key inválida o sin saldo | Fallos de IA | Mensajes de error claros con el error del proveedor; probar la key al guardarla (Sprint 3). |
| Tokens de Meta expiran (~60 días) | Publicación/analítica fallan | Mostrar estado de conexión y botón de reconectar; aviso por fecha de expiración. |
| Sin pruebas automáticas | Regresiones silenciosas | Sprint 6: pruebas de aislamiento, cifrado, auth; antes, verificación manual por flujo. |
