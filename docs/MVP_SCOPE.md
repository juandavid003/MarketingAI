# Alcance del MVP

> Última actualización: 2026-11-16.

## Hipótesis que el MVP debe validar

> Un negocio pequeño pagará ~USD 99/mes por un sistema que le dice qué grabar, le edita el video, lo publica y le muestra qué clientes le trajo.

El MVP está "terminado" cuando **un cliente real que paga** puede completar el ciclo semanal (recorridos 2, 3 y 4 de [PRODUCT_FLOWS.md](PRODUCT_FLOWS.md)) sin ayuda del fundador.

## Dentro del MVP

| # | Funcionalidad | Estado |
|---|---|---|
| 1 | Registro, habilitación manual, onboarding | ✅ |
| 2 | Perfil completo del negocio, editable, usado por toda la IA | Sprint 1 |
| 3 | Oportunidades de contenido **solo con datos reales** | Sprint 1 (quitar datos de ejemplo) |
| 4 | Competidores: registro + datos públicos disponibles, con limitaciones explicadas | ✅ parcial → Sprint 5 |
| 5 | Campaña por oportunidad u objetivo + plan semanal | ✅ parcial → Sprint 3 |
| 6 | Guion escena por escena | ✅ |
| 7 | Subida de video + edición IA en segundo plano, almacenamiento privado | Sprint 1 |
| 8 | Quitar silencios, aviso de regrabación | Sprint 3 |
| 9 | Exportación (descarga + paquete con caption/hashtags) | Sprint 4 |
| 10 | Publicación en Facebook ✅, Instagram, programación y reintentos | Sprint 4 |
| 11 | Enlaces rastreables, QR, códigos promo, registro de leads | Sprint 2 |
| 12 | Dashboard de resultados (plataforma vs negocio separados) | Sprint 2 |
| 13 | Cifrado de tokens, aislamiento, pruebas básicas | Sprint 1 + Sprint 6 |

## Fuera del MVP (explícito)

| Funcionalidad | Por qué no ahora | Cuándo reconsiderar |
|---|---|---|
| **Pauta pagada en Meta Ads** | ❄️ Congelada. Requiere revisión del negocio (responsabilidad sobre gasto del cliente, App Review de `ads_management`). El código existe pero está apagado con `FEATURE_ADS`. | Tras validar el ciclo orgánico y definir el modelo comercial de pauta. |
| Asistente conversacional (módulo I) | Requiere primero datos de rendimiento y leads acumulados para ser útil. | Cuando haya ≥ 2 meses de datos en clientes piloto. |
| Generación de video 100% con IA (Veo, Kling…) | Caro por segundo y no resuelve el problema principal ("no sé editar lo que grabo"). | Como escenas de relleno (B-roll), post-MVP. |
| Publicación directa en TikTok | La Content Posting API exige auditoría de la app; sin ella las publicaciones quedan privadas. | Tras auditoría. Mientras: paquete de exportación. |
| Publicación directa en YouTube Shorts | Cuota diaria limitada de la YouTube Data API y verificación OAuth. | Cuando haya demanda real. Mientras: exportación. |
| Radar de tendencias con fuentes externas (Google Trends, etc.) | Sin API oficial estable de acceso general; no se hace scraping. | Si Google abre su Trends API o aparece una fuente autorizada. |
| Landing pages por campaña | Los enlaces rastreables a WhatsApp/web cubren el caso principal. | Si los pilotos lo piden. |
| CRM (pipeline, tareas, recordatorios) | Fuera del foco; registramos leads, no gestionamos ventas. | No planeado. |
| Analítica predictiva, agentes autónomos | Sobreingeniería para la etapa. | No planeado. |
| Organizaciones multiusuario y roles | Hecho en forma simple (Sprint 6): dueño + encargados de redes por negocio. Sin organizaciones con varios dueños. | Organizaciones completas si un cliente lo pide. |
| Pasarela de pago / planes múltiples | Cobro manual alcanza para < 20 clientes. | Tras validar pago recurrente. |
| Música | Riesgo de derechos de autor. | Biblioteca con licencia, post-MVP. |

## Reglas de alcance

- No se agregan pantallas vacías ni botones que no hacen nada.
- Una funcionalidad entra solo con backend + frontend funcionando de punta a punta.
- Cualquier dato de ejemplo debe estar etiquetado como tal **y no parecer una métrica real** (preferible: estado vacío).
