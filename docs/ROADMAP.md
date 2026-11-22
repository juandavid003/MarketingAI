# Hoja de ruta

> Última actualización: 2026-11-21. Sprints de ~1 semana para un fundador que trabaja solo. Complejidad: S (≤1 día) · M (2–3 días) · L (≈1 semana).

## Sprint 0 — Alineación ✅
- Congelar la pauta (`FEATURE_ADS`), dejar de pedir `ads_management`.
- Documentación en `/docs`.

## Sprint 1 — Cimientos honestos y seguros ✅ (código listo 2026-11-16; producción migrando a DigitalOcean)
Objetivo: nada inventado, nada expuesto, nada que se pierda en un despliegue.

Verificado con una prueba de navegador real (23/23) contra una base de datos local desechable: perfil, estado vacío honesto, subida y procesamiento en segundo plano, reintento, archivos privados (dueño 200/206, otro cliente 404, anónimo 401) y aislamiento entre negocios.

| Tarea | Complejidad |
|---|---|
| Quitar los insights de ejemplo con cifras inventadas y la lógica fija por industria; estado vacío honesto | S |
| Cifrar tokens de Meta en reposo (compatibles con los ya guardados) | S |
| `lib/storage.ts` + ruta autenticada `/api/files/*`; videos e imágenes fuera de `public/` | M |
| Procesamiento de video en segundo plano (`after()`), página con estado que se refresca, reintento | M |
| Perfil del negocio ampliado + página para editarlo | M |
| `lib/businessContext.ts`: un solo contexto de negocio para todos los prompts | S |
| **Infraestructura:** migración a DigitalOcean (droplet + Docker + GitHub Actions), ver `deploy/README.md` | M |

## Adelantado 2026-11-18 — Del guion al video final + competencia con evidencia
Pedido del fundador: guion genérico, ideas basadas en lo que funciona a la competencia y armado del video final.
- `ContentPiece` (hook, escenas, descripción, hashtags, CTAs, propósito) desde campaña, idea de la competencia o encargo libre.
- Una toma por escena (`SceneTake`): quita silencios, transcribe, revisa y avisa "conviene volver a grabar" con motivo.
- Armado del video final 9:16 + 4:5 con subtítulos y texto en pantalla en el color de marca.
- Competidores con usuario de Instagram (Business Discovery), estadísticas reales, publicaciones manuales e ideas con fuente.
- **Distribuidor** (`/business/[id]/pieces/[pieceId]/creatives`): 3 hooks + 2 CTAs alternativos, creativos hook × CTA del mismo video, calendario por red con copy propio, registro de resultados y ganador por fase.
- **Pendiente para activar Business Discovery:** habilitar `instagram_manage_insights` en la app de Meta y poner `META_REQUEST_IG_INSIGHTS=true`; luego cada cliente reconecta Meta.

## Adelantado 2026-11-18 (2) — App por módulos + Sprint 2
Pedido del fundador: separar la app en módulos al lado del selector de negocio, todo dentro del negocio seleccionado (un cliente puede tener varios negocios).
- Barra lateral por módulos: Resumen · Crear (Generador de ideas, Copywriter, Distribuidor de estrategia, Manager de contenido, Videos) · Medir (Enlaces y códigos, Leads, Resultados) · Negocio (Perfil, Conexiones, IA). Definidos en `src/components/business/modules.ts`; al cambiar de negocio se mantiene el módulo. `/start` abre el último negocio usado.
- **Manager de contenido** (`/calendar`): calendario mensual multiformato (reel, carrusel, historia, post, video largo, en vivo) con estados, planificador con IA que usa campañas y guiones, y envío del plan del Distribuidor al calendario.
- **Sprint 2 hecho:** `TrackedLink` + `/r/[slug]` (UTM, clics sin datos personales, sin contar vistas previas de bots), QR PNG/SVG, enlaces a WhatsApp con referencia, códigos promocionales, registro de leads con confianza de atribución (alta/media/baja) y panel **Resultados** que separa negocio de métricas de plataforma.

## Sprint 2 — Leads y resultados (diferenciador) ✅ (ver arriba)
| Tarea | Complejidad |
|---|---|
| `TrackedLink` + `/r/[slug]` (redirección con UTM, conteo de clics sin datos personales) | M |
| QR descargable por enlace | S |
| Códigos promocionales por campaña | S |
| Registro de leads (origen, estado, valor) | M |
| Panel **Resultados**: plataforma vs negocio, separados, con confianza de atribución | M |

## Sprint 3 — Del plan al video correcto ✅ 2026-11-18
- Plan semanal multiformato: Manager de contenido. Textos y hashtags **por red** para cada guion (`lib/platformCopy.ts`).
- Video completo "para el guion X" (toma `full`): se edita como el armado por escenas y sirve para los creativos.
- Quitar silencios: hecho (`lib/videoEdit.ts`).
- **Gemini (spike listo para medir):** revisión visual por toma con la key de Gemini del cliente (`lib/visualReview.ts`), con tokens y costo estimado por toma en Configuración → IA. Falta correrlo con 5–10 videos reales y decidir.
- Las keys (Anthropic, OpenAI, Gemini) y el modelo efectivo se verifican al guardarlas (`lib/keyCheck.ts`).

| Tarea | Complejidad |
|---|---|
| Plan semanal (pilares, propósito, día, formato, hook) + captions y hashtags por plataforma | M |
| Subir video "para la pieza X" (vincula guion ↔ video) | S |
| Quitar silencios (ffmpeg `silencedetect` + tiempos de Whisper) | M |
| **Spike Gemini:** 5–10 videos reales; comparar elección de fragmento y detección de problemas vs transcripción; medir costo | M |
| Si el spike sale bien: aviso "volver a grabar la escena X porque…" | M |
| Probar la API key al guardarla | S |

## Sprint 4 — Publicar en todas partes (con lo que permiten las APIs) ✅ 2026-11-18
- Módulo **Publicaciones**: publicar ahora o programar (`PublishJob`), estado, 3 intentos con reintento a los 5 y 20 min, errores visibles, “Reintentar”. Programador en el proceso web (`src/instrumentation.ts` → `lib/jobs/publishScheduler.ts`, cada minuto).
- Facebook (video en la página) e **Instagram Reels** vía Content Publishing API con URL firmada temporal (`lib/signedMedia.ts`, `/api/media`). Instagram queda apagado hasta que Meta apruebe `instagram_content_publish` (`META_REQUEST_IG_PUBLISH=true`).
- TikTok / YouTube / manual: recordatorio + **paquete** zip (formatos, portadas, textos por red) + “Ya lo publiqué”.
- Formatos 9:16, 4:5 y **1:1**; **logo** de la marca en los videos (Perfil → Logo).

| Tarea | Complejidad |
|---|---|
| Publicar en Instagram (Reels) vía Content Publishing API (URL firmada temporal) | M |
| Programación + `PublishJob` con estado, reintentos y errores visibles | M |
| Paquete de exportación (TikTok / YouTube / manual) + "marcar como publicado" | S |
| Versiones 1:1 y 4:5, colores de marca en subtítulos, logo | M |

## Sprint 5 — Competencia y tendencias con evidencia ✅ 2026-11-19
- Business Discovery (frecuencia, formatos, engagement, captions) y patrones de hook/tema/formato/CTA extraídos por IA **de captions reales** con enlace a cada fuente ya estaban (`lib/competitorDiscovery.ts`, `lib/competitorStats.ts`, `lib/contentAi.ts`).
- Ad Library: Competencia explica por país qué se puede ver (`adLibraryCoverage` en `lib/adLibrary.ts`): fuera de la UE la API solo entrega anuncios políticos/sociales, así que enlazamos a la biblioteca web filtrada por país. Avisa si el país de la ubicación no se reconoció.
- **Fechas que vienen** en Generador de ideas (`lib/seasonal.ts`): fechas comerciales y feriados por país (EC, MX, CO, PE, CL, AR, US, ES) + fiestas de Quito, Guayaquil y Cuenca, con "prepáralo ya"/"desde el…" según la anticipación de cada fecha y botón para crear la campaña.

| Tarea | Complejidad |
|---|---|
| Competidores con usuario de Instagram → Business Discovery (frecuencia, formatos, engagement, captions) | M |
| Hooks/temas/CTAs frecuentes extraídos por IA **de captions reales**, con enlace a la fuente | M |
| Ad Library: mostrar limitaciones por país + enlace a la biblioteca web | S |
| Oportunidades estacionales (calendario local) | S |

## Sprint 6 — Listo para piloto pagado ✅ 2026-11-19
- **Pruebas** (`npm test`, Vitest; corren en GitHub Actions antes de cada deploy junto con typecheck y lint): reglas de acceso y roles, guardia estático que exige verificación de acceso en **cada** acción de servidor, ruta y página de negocio, cifrado AES-GCM y URLs firmadas, redirección `/r/[slug]` (UTM, bots, slugs inválidos), llaves de almacenamiento, límites de uso, invitaciones y **pipeline de video** completo con un video de muestra generado por ffmpeg. `npm run test:db` prueba el aislamiento contra la base real (filas `__test__` que se borran al terminar).
- **Equipo:** el dueño invita a su encargado de redes desde *Equipo* con un enlace secreto (el registro no verifica correos, así que el correo no da acceso). El encargado trabaja (ideas, guiones, videos, publicar, enlaces, leads) pero no ve keys, conexiones ni equipo, y no necesita pagar; si el dueño queda deshabilitado, el negocio se cierra para ambos.
- **`AuditEvent`** en keys, conexión/desconexión de Meta, publicar/programar/cancelar/reintentar, resultados del programador, habilitar cuentas y equipo. Visible en *Equipo* (por negocio) y en /admin.
- **Límites de uso** por negocio: 120 min de video al mes y 10 GB (ajustables con `USAGE_VIDEO_MINUTES_PER_MONTH` y `USAGE_STORAGE_GB`), mostrados en *Videos*. Los originales subidos para editar se borran 30 días después de estar listos (las versiones editadas se conservan; las tomas por escena no se tocan porque se re-arman desde ellas).
- **Negocio de demostración** (panadería ficticia con competidores, enlace, código y leads) desde el onboarding, eliminable; y **"Enviar comentarios"** en la barra lateral, leído en /admin.

| Tarea | Complejidad |
|---|---|
| Pruebas: aislamiento entre negocios, auth, cifrado, pipeline de video (con video de muestra), redirección de enlaces | L |
| `AuditEvent` en acciones sensibles | S |
| Límites de uso (tamaño de archivo, minutos/mes, almacenamiento) + limpieza de originales | M |
| Organizaciones y roles (encargado de redes) | M |
| Negocio de demostración + recolección de feedback in-app | S |

## Asistente de crecimiento (módulo I) ✅ 2026-11-19
- Chat en *Medir → Asistente de crecimiento*, para dueño y encargado, con la IA del negocio (su key).
- **La app calcula las cifras, no la IA:** `lib/assistantData.ts` arma datos numerados ([F1], [F2]…) con las mismas definiciones que *Resultados* — clics, leads, clientes y ventas de 30 días contra los 30 anteriores, confianza del origen, leads abiertos, campañas/contenidos/canales/enlaces que traen clientes, ejecución del plan, publicaciones, métricas de creativos (separadas: no son clientes), competencia, fechas que vienen y huecos del perfil. Cada dato enlaza a la página donde se comprueba.
- La IA solo puede usar esos datos y debe citarlos; `parseAnswer` convierte las citas en enlaces, lista las fuentes debajo de cada respuesta y **marca** citas inexistentes o cifras que no están en los datos.
- La respuesta guarda los datos que vio, así sus citas siguen siendo válidas aunque los números cambien. Conversación por persona y negocio, límite de 40 preguntas cada 24 h. La IA no recibe datos de contacto de los leads.

## Limpieza de módulos + video con IA ✅ 2026-11-21
Pedido del fundador: quitar funciones repetidas entre módulos, UI/UX más simple, y video con IA que se pueda cambiar de proveedor.
- **Barra lateral de 15 a 7 entradas**, con pestañas dentro de cada módulo (`src/components/business/modules.ts`): Resumen · **Ideas** (ideas y campañas, competencia) · **Contenido** (guiones, creativos, videos) · **Calendario** (calendario, publicaciones) · **Resultados** (resultados, leads, enlaces y códigos) · **Asistente** · **Negocio** (perfil, IA, conexiones, equipo; las del dueño ocultas para el encargado). Las URLs no cambiaron.
- Quitado lo repetido: un solo `Notice` para avisos (había copias locales), un solo `AiRequired` para "configura tu IA" (4 variantes), un helper para el redirect por falta de IA (4 copias); Configuración ahora muestra el motivo del redirect (antes se perdía). *Creativos* ya no repite la lista de guiones: muestra solo videos listos para multiplicar.
- **Video con IA por escena** con proveedores intercambiables (Gemini Omni Flash, fal.ai con Kling/Seedance), modelo editable por negocio o por variable de entorno. Ver [`AI_VIDEO.md`](AI_VIDEO.md).
- Skills de Claude Code para video (fal.ai y Remotion) en `.claude/skills/`.
- **2026-11-22:** elegir la IA en cada escena con la recomendada preseleccionada y su motivo; proveedor **OpenAI imagen + movimiento + voz** (funciona con solo Claude + OpenAI); “Mejorar con Claude” para la descripción; combinación recomendada y guía por red en Configuración.

## Después del MVP
- TikTok / YouTube directos (tras auditoría/cuotas).
- Reactivar pauta (tras revisión de negocio).
- Pasarela de pago y planes.
- Worker separado + cola en Postgres; almacenamiento en R2.
- Imagen → video (animar fotos de producto) sobre la misma capa `lib/videoGen`.

## Dependencias externas (largas — empezar ya)
1. **Business Verification de Meta** (días–semanas).
2. **App Review de Meta** para `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `business_management` (+ `instagram_content_publish` para Sprint 4).
3. Auditoría de TikTok (si se decide publicar directo).
