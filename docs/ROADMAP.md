# Hoja de ruta

> Última actualización: 2026-11-16. Sprints de ~1 semana para un fundador que trabaja solo. Complejidad: S (≤1 día) · M (2–3 días) · L (≈1 semana).

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

## Sprint 2 — Leads y resultados (diferenciador)
| Tarea | Complejidad |
|---|---|
| `TrackedLink` + `/r/[slug]` (redirección con UTM, conteo de clics sin datos personales) | M |
| QR descargable por enlace | S |
| Códigos promocionales por campaña | S |
| Registro de leads (origen, estado, valor) | M |
| Panel **Resultados**: plataforma vs negocio, separados, con confianza de atribución | M |

## Sprint 3 — Del plan al video correcto
| Tarea | Complejidad |
|---|---|
| Plan semanal (pilares, propósito, día, formato, hook) + captions y hashtags por plataforma | M |
| Subir video "para la pieza X" (vincula guion ↔ video) | S |
| Quitar silencios (ffmpeg `silencedetect` + tiempos de Whisper) | M |
| **Spike Gemini:** 5–10 videos reales; comparar elección de fragmento y detección de problemas vs transcripción; medir costo | M |
| Si el spike sale bien: aviso "volver a grabar la escena X porque…" | M |
| Probar la API key al guardarla | S |

## Sprint 4 — Publicar en todas partes (con lo que permiten las APIs)
| Tarea | Complejidad |
|---|---|
| Publicar en Instagram (Reels) vía Content Publishing API (URL firmada temporal) | M |
| Programación + `PublishJob` con estado, reintentos y errores visibles | M |
| Paquete de exportación (TikTok / YouTube / manual) + "marcar como publicado" | S |
| Versiones 1:1 y 4:5, colores de marca en subtítulos, logo | M |

## Sprint 5 — Competencia y tendencias con evidencia
| Tarea | Complejidad |
|---|---|
| Competidores con usuario de Instagram → Business Discovery (frecuencia, formatos, engagement, captions) | M |
| Hooks/temas/CTAs frecuentes extraídos por IA **de captions reales**, con enlace a la fuente | M |
| Ad Library: mostrar limitaciones por país + enlace a la biblioteca web | S |
| Oportunidades estacionales (calendario local) | S |

## Sprint 6 — Listo para piloto pagado
| Tarea | Complejidad |
|---|---|
| Pruebas: aislamiento entre negocios, auth, cifrado, pipeline de video (con video de muestra), redirección de enlaces | L |
| `AuditEvent` en acciones sensibles | S |
| Límites de uso (tamaño de archivo, minutos/mes, almacenamiento) + limpieza de originales | M |
| Organizaciones y roles (encargado de redes) | M |
| Negocio de demostración + recolección de feedback in-app | S |

## Después del MVP
- Asistente de crecimiento (módulo I) sobre datos reales.
- TikTok / YouTube directos (tras auditoría/cuotas).
- Reactivar pauta (tras revisión de negocio).
- Pasarela de pago y planes.
- Worker separado + cola en Postgres; almacenamiento en R2.
- Generación de B-roll con IA.

## Dependencias externas (largas — empezar ya)
1. **Business Verification de Meta** (días–semanas).
2. **App Review de Meta** para `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `business_management` (+ `instagram_content_publish` para Sprint 4).
3. Auditoría de TikTok (si se decide publicar directo).
