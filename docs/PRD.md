# PRD — Plataforma de crecimiento de contenido con IA

> Última actualización: 2026-11-16. Estado de cada requisito: ✅ existe · 🟡 parcial · ⬜ no existe · ❄️ congelado.

## 1. Objetivo

Que un negocio pequeño, de cualquier industria, publique contenido útil cada semana con poco esfuerzo y pueda ver qué contenido le trae clientes. Ver [PRODUCT_VISION.md](PRODUCT_VISION.md).

## 2. Perfiles de usuario

### P1 — "Dueña que lo hace todo" (persona principal)
- Dueña de una clínica dental / salón / restaurante con 2–15 empleados.
- Publica en Instagram/Facebook "cuando puede". Graba con su celular.
- No sabe editar, no tiene tiempo, no entiende métricas.
- **Quiere:** saber qué grabar esta semana, que alguien lo edite, y saber si le trae pacientes/clientes.
- **Paga por:** ahorro de tiempo + clientes nuevos visibles.

### P2 — "Encargado de redes" (persona secundaria)
- Empleado o freelance que maneja las redes de 1–3 negocios.
- Sabe algo de contenido, quiere producir más rápido y demostrarle resultados al dueño.
- **Quiere:** calendario, guiones, edición rápida, reporte para el jefe.

### P3 — "Administrador de la plataforma" (interno)
- El fundador. Crea/habilita cuentas, confirma pagos, da soporte.

### Fuera de foco (por ahora)
- Agencias con 20+ clientes, marcas grandes, creadores/influencers.

## 3. Requisitos funcionales por módulo

### A. Registro y perfil del negocio
| ID | Requisito | Estado |
|---|---|---|
| A1 | Onboarding que crea un negocio con datos mínimos (nombre, industria, descripción, productos, público, ubicación, objetivo, ticket promedio) | ✅ |
| A2 | Perfil completo: subindustria, propuesta de valor, zonas de cobertura, tono de marca, colores, idioma del contenido, redes principales, CTAs preferidos, sitio web, WhatsApp/teléfono/email, metas de conversión, perfiles de cliente ideal | ⬜ → Sprint 1 |
| A3 | Editar el perfil en cualquier momento | ⬜ → Sprint 1 |
| A4 | "Contexto del negocio" único que alimenta todas las llamadas de IA | 🟡 (cada prompt arma su propio contexto, incompleto) → Sprint 1 |
| A5 | Configuración por industria extensible (sugerencias de pilares, CTAs, ejemplos) como **datos**, no código | ⬜ → Sprint 3 |

### B. Inteligencia de competidores
| ID | Requisito | Estado |
|---|---|---|
| B1 | Registrar competidores por nombre | ✅ |
| B2 | Registrar perfiles sociales del competidor (usuario de Instagram, página de Facebook, sitio) | ⬜ → Sprint 5 |
| B3 | Ver anuncios activos vía Meta Ad Library API | 🟡 — **riesgo:** la API solo cubre anuncios comerciales entregados en UE/Reino Unido; fuera de ahí, principalmente políticos. Ver [API_INTEGRATIONS.md](API_INTEGRATIONS.md) |
| B4 | Análisis de contenido orgánico público (formatos, frecuencia, hooks, temas, engagement) vía Instagram Business Discovery | ⬜ → Sprint 5 |
| B5 | Recomendaciones accionables + explicación explícita de qué datos hay y cuáles no | ⬜ → Sprint 5 |

### C. Radar de tendencias
| ID | Requisito | Estado |
|---|---|---|
| C1 | Oportunidades basadas en datos reales propios (inactividad, contenido con más interacción, productos no mencionados) | ✅ (`lib/realInsights.ts`) |
| C2 | Eliminar los "insights de ejemplo" con cifras inventadas | ⬜ → **Sprint 1, prioridad 1** |
| C3 | Oportunidades estacionales (fechas del calendario local) — fuente: calendario de fechas, sin inventar métricas | ⬜ → Sprint 5 |
| C4 | Cada recomendación: oportunidad, por qué importa, público, concepto, hook, formato, CTA, relevancia, ventana (solo si hay datos) | 🟡 → Sprint 3 |

### D. Estratega de contenido
| ID | Requisito | Estado |
|---|---|---|
| D1 | Campaña generada por IA desde una oportunidad o un objetivo libre | ✅ |
| D2 | Guion escena por escena por pieza (qué hacer, qué decir, cómo grabar) | ✅ |
| D3 | Plan semanal: pilares, ideas con **propósito** (reconocimiento / interacción / leads / conversión / fidelización), día sugerido | ⬜ → Sprint 3 |
| D4 | Captions y hashtags por plataforma | ⬜ → Sprint 3 |
| D5 | Vincular el video que sube el usuario con la escena/guion que debía grabar | ⬜ → Sprint 3 |

### E. Estudio de video
| ID | Requisito | Estado |
|---|---|---|
| E1 | Subir video propio | ✅ |
| E2 | Transcripción con tiempos (Whisper) | ✅ |
| E3 | Elegir el mejor fragmento + hook + CTA | ✅ (solo con la transcripción) |
| E4 | Clip vertical 9:16 con subtítulos quemados + miniatura | ✅ |
| E5 | Almacenamiento **privado** y persistente; procesamiento en **segundo plano** con estado y reintento | ⬜ → **Sprint 1** |
| E6 | Quitar pausas/silencios | ⬜ → Sprint 3 |
| E7 | Varias versiones/formatos (9:16, 1:1, 4:5) | ⬜ → Sprint 4 |
| E8 | Elementos de marca (logo, colores en subtítulos) | ⬜ → Sprint 4 |
| E9 | Análisis visual (Gemini) y aviso "conviene volver a grabar" con motivo | ⬜ → spike en Sprint 3 |
| E10 | Música de fuentes autorizadas (solo sugerencia/biblioteca con licencia) | ⬜ → posterior |
| E11 | Descargar el video final | ✅ (archivo accesible) → se mantiene con almacenamiento privado |

### F. Publicación
| ID | Requisito | Estado |
|---|---|---|
| F1 | Publicar imagen y video en Página de Facebook con aprobación manual | ✅ |
| F2 | Publicar en Instagram (Reels/feed) | ⬜ → Sprint 4 |
| F3 | Programar publicaciones, estado, reintento de fallidas | ⬜ → Sprint 4 |
| F4 | Exportar "paquete de publicación" (video + caption + hashtags) para TikTok / YouTube Shorts / manual | ⬜ → Sprint 4 |
| F5 | Publicación directa en TikTok / YouTube | ⬜ → después de auditoría/cuotas |

### G. Analítica
| ID | Requisito | Estado |
|---|---|---|
| G1 | Actividad de páginas de Facebook (publicaciones, compartidos) e Instagram (likes, comentarios, seguidores) | ✅ |
| G2 | Rendimiento por pieza publicada desde la app | ✅ |
| G3 | Dashboard unificado que **separa** métricas de plataforma de resultados de negocio | ⬜ → Sprint 2 |
| G4 | Comparar por contenido / plataforma / campaña / período / formato / objetivo | ⬜ → Sprint 4+ |

### H. Leads y conversiones (diferenciador)
| ID | Requisito | Estado |
|---|---|---|
| H1 | Enlaces rastreables (slug corto + UTM) por campaña/pieza | ⬜ → **Sprint 2** |
| H2 | Conteo de clics (sin datos personales del visitante) | ⬜ → Sprint 2 |
| H3 | Código QR del enlace | ⬜ → Sprint 2 |
| H4 | Códigos promocionales por campaña | ⬜ → Sprint 2 |
| H5 | Registro manual de leads con origen (enlace / código / "me dijo que vio el video" / desconocido) | ⬜ → Sprint 2 |
| H6 | Estado del lead (nuevo → contactado → cliente / perdido) y valor de la venta | ⬜ → Sprint 2 |
| H7 | Atribución con nivel de confianza explícito; nunca afirmar origen sin evidencia | ⬜ → Sprint 2 |
| H8 | Landing pages por campaña | ⬜ → posterior |

### I. Asistente de crecimiento
| ID | Requisito | Estado |
|---|---|---|
| I1 | Chat que responde con datos reales del negocio y cita de dónde sale cada cifra | ⬜ → después del MVP |

### Plataforma
| ID | Requisito | Estado |
|---|---|---|
| X1 | Cuentas email/contraseña | ✅ |
| X2 | Aislamiento por negocio en cada página/acción (`requireBusinessAccess`) | ✅ |
| X3 | Panel admin para habilitar/deshabilitar clientes | ✅ |
| X4 | Secretos de terceros cifrados en reposo (keys de IA ✅, tokens de Meta ⬜) | 🟡 → **Sprint 1** |
| X5 | Organizaciones con varios usuarios y roles (dueño/editor/lector) | ⬜ → Sprint 6 |
| X6 | Registro de auditoría | ⬜ → Sprint 6 |
| X7 | Límites de uso por plan (almacenamiento, minutos de video) | ⬜ → Sprint 6 |
| X8 | Pasarela de pago | ⬜ → después de validación |
| ❄️ | Pauta en Meta Ads (crear/activar/pausar campañas pagadas) | ❄️ congelado (`FEATURE_ADS`) |

## 4. Requisitos no funcionales

| Área | Requisito |
|---|---|
| Seguridad | Ningún secreto en el frontend ni en git. Keys de IA y tokens de Meta cifrados (AES-256-GCM). Archivos de cada negocio solo accesibles por ese negocio. |
| Aislamiento | Toda consulta de datos de negocio pasa por `requireBusinessAccess`; las relaciones hijas se validan contra el `businessId`. Pruebas automáticas de aislamiento (Sprint 6). |
| Veracidad | Cada métrica mostrada indica su fuente (plataforma / registrada manualmente / calculada). Prohibido mostrar cifras de ejemplo como reales. |
| Rendimiento | Páginas principales < 2 s con datos en caché; procesamiento de video asíncrono, nunca bloquea la petición. |
| Disponibilidad | Un trabajo interrumpido (reinicio del servidor) queda marcado y se puede reintentar. |
| Costo | Infra base ≈ USD 12/mes (un droplet de DigitalOcean con app + Postgres) para los primeros clientes; +USD 2–3 si se activan backups del droplet. IA la paga el cliente. |
| Idioma | UI en español. Contenido generado en el idioma configurado del negocio. |
| Responsivo | Usable en celular (el dueño revisa y aprueba desde el teléfono). |
| Privacidad | Solo datos públicos/autorizados de competidores. Clics registrados sin IP ni datos personales identificables. |

## 5. Métricas de éxito del producto

Ver [VALIDATION_PLAN.md](VALIDATION_PLAN.md). Principales: activación en 7 días, piezas publicadas por semana, leads registrados por mes, retención del mes 2.
