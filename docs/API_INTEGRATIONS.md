# Integraciones con APIs — matriz de viabilidad

> Última actualización: 2026-11-16.
> **Leyenda de verificación:** ✅ *probado en el código de este repo* · 📄 *según documentación oficial, revisar antes de implementar* · ⚠️ *según fuentes secundarias o memoria; VERIFICAR en la documentación oficial antes de escribir código.*
> Regla: no se implementa ninguna integración sin leer primero la documentación oficial vigente. Solo APIs oficiales y permisos autorizados; nada de scraping.

## Meta (Facebook / Instagram)

| Capacidad | Endpoint / permiso | Viabilidad | Verif. | Notas |
|---|---|---|---|---|
| Login y listar Páginas | OAuth, `pages_show_list`, `business_management` | Sí | ✅ | `api/auth/meta/*`. Token de usuario de larga duración (~60 días). |
| Publicar foto/video en Página | `/{page-id}/photos`, `/{page-id}/videos`, `pages_manage_posts` | Sí | ✅ | Subida multipart de bytes (no URL pública). Acceso estándar solo para páginas que administra quien conecta; para clientes reales requiere **App Review**. |
| Leer publicaciones y compartidos de Página | `/{page-id}/posts`, `pages_read_engagement` | Sí | ✅ | Likes/comentarios de FB requieren Advanced Access. |
| Leer medios, likes, comentarios y seguidores de IG propio | IG Graph API, `instagram_basic` | Sí | ✅ | Cuenta profesional vinculada a una Página. |
| Insights de IG (alcance, impresiones, guardados, reproducciones) | `instagram_manage_insights` | Probable | ⚠️ | No ofrecido en el caso de uso actual del panel; requiere App Review. |
| Publicar en IG (Reels / feed) | Content Publishing API (`/{ig-user-id}/media` + `media_publish`), `instagram_content_publish` | Sí, con límites | 📄 | Requiere que el video esté en una **URL pública** que Meta descarga → necesitaremos URL firmada temporal. Límite diario de publicaciones por cuenta. |
| Datos públicos de **otras** cuentas profesionales de IG | Business Discovery (`?fields=business_discovery.username(x){...}`) | Sí | ✅ código | Seguidores, medios recientes, like_count, comments_count de cuentas Business/Creator (`lib/competitorDiscovery.ts`). Según la doc oficial (revisada 2026-11-18) requiere `instagram_basic` + **`instagram_manage_insights`** + `pages_read_engagement`. El permiso extra solo se pide con `META_REQUEST_IG_INSIGHTS=true`, después de habilitarlo en el panel de Meta (si no, el diálogo OAuth falla). Sin alcance ni vistas de cuentas ajenas; cuentas con restricción de edad no devuelven datos. Alternativa sin API: publicaciones de referencia registradas a mano. |
| Anuncios activos de competidores | Ad Library API (`/ads_archive`) | **Limitada** | ⚠️ | Hasta donde sabemos, la API devuelve anuncios comerciales **solo si se entregaron en la UE/Reino Unido**; en otros países, principalmente anuncios políticos/sociales. Para LatAm probablemente devuelva poco o nada. La biblioteca **web** sí muestra todo, pero no se puede scrapear → enlazar a ella. Requiere Business Verification. |
| Pauta (campañas, conjuntos, anuncios) | Marketing API, `ads_management` | Sí | ✅ | ❄️ **Congelado.** No se pide el permiso mientras `FEATURE_ADS` esté apagado. |

## TikTok

| Capacidad | API | Viabilidad | Verif. | Notas |
|---|---|---|---|---|
| Publicar video | Content Posting API (Direct Post) | Condicional | ⚠️ | Sin **auditoría** de la app, lo publicado queda en modo privado. Alternativa MVP: paquete de exportación + publicación manual, o "Upload" a borradores del usuario. |
| Métricas del propio video | Display API / Research API | Limitada | ⚠️ | Research API solo para investigación académica. |
| Datos de competidores / tendencias | — | **No** | ⚠️ | No hay API oficial para comerciales; Creative Center no tiene API. No se hace scraping. |

## YouTube

| Capacidad | API | Viabilidad | Verif. | Notas |
|---|---|---|---|---|
| Subir Shorts | Data API v3 `videos.insert` | Sí, con cuota | ⚠️ | Un Short es un video vertical corto. La subida consume mucha cuota diaria del proyecto (10.000 unidades por defecto); verificar costo actual por subida. Requiere verificación OAuth de Google para scopes sensibles. |
| Métricas | YouTube Analytics API | Sí | ⚠️ | |

## Tendencias

| Fuente | Viabilidad | Verif. | Notas |
|---|---|---|---|
| Google Trends | Limitada | ⚠️ | Históricamente sin API pública; Google anunció una Trends API en acceso limitado. Verificar disponibilidad. **No usar librerías no oficiales que scrapean.** |
| Datos propios del negocio | Sí | ✅ | Base del radar actual (`lib/realInsights.ts`). |
| Calendario de fechas/estacionalidad | Sí | — | Datos propios (feriados locales, fechas comerciales); no requiere API. |
| Business Discovery de competidores | Sí | 📄 | Hooks/temas frecuentes calculados sobre captions reales. |

## IA

| Proveedor | Uso | Verif. | Notas |
|---|---|---|---|
| Anthropic (Messages API) | Texto: campañas, guiones, análisis | ✅ | Key del cliente. |
| OpenAI (Chat Completions) | Texto | ✅ | Key del cliente. |
| OpenAI Whisper | Transcripción con tiempos | ✅ | Key del cliente. ~USD 0.006/min. |
| OpenAI GPT Image | Imágenes de campaña | ✅ | Key del cliente; sin key → imagen de vista previa marcada. |
| Google Gemini | Análisis visual del video completo (momentos, problemas para regrabar) | ⚠️ | Spike planeado (Sprint 3) con 5–10 videos reales antes de integrar. |
| Generación de video (Veo, Kling, Runway) | B-roll futuro | ⚠️ | Post-MVP. Sora API retirada (sep-2026). |

## Herramientas locales

| Herramienta | Uso | Notas |
|---|---|---|
| ffmpeg / ffprobe | Duración, audio, recorte, 9:16, subtítulos quemados, miniaturas; Sprint 3: silencios (`silencedetect`) | Instalado en la imagen Docker (Dockerfile). |

## Flujo alternativo cuando no hay integración

Para cualquier plataforma sin integración aprobada: **paquete de exportación** = video final + caption adaptado + hashtags + enlace rastreable + instrucciones. El usuario publica a mano y marca la pieza como "publicada manualmente" (con el link, opcional) para que entre en la analítica.
