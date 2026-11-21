# Video con IA

> 2026-11-21. Cómo genera la app escenas con IA, qué proveedor usar hoy y cómo cambiarlo mañana.

## Qué hace

En cada escena de un guion (*Contenido → Guiones → guion*), además de **Subir toma**, el dueño o encargado puede **“Generar con IA”**: la app arma una descripción de la escena (qué se ve, cámara y luz, tono y colores de marca, la frase que dice el narrador), el usuario la puede editar, y el proveedor de video del negocio genera un clip vertical 9:16. Ese clip **entra como una toma más**: se le quitan silencios, se transcribe, se revisa y se arma con las demás escenas (subtítulos, hook, logo, 9:16 / 4:5 / 1:1). Creativos, calendario y publicaciones no distinguen si una escena se grabó o se generó (la toma muestra la marca “Generada con IA”).

Decisiones:
- **La IA rellena escenas, no reemplaza el flujo.** Grabar sigue siendo lo principal (más barato y más auténtico); la IA cubre tomas de producto, ambiente o B-roll que el dueño no puede grabar.
- **Sin texto en el clip.** El prompt pide no poner textos ni logos: los pone el armado en el color de marca.
- **Narrador fuera de cámara, sin personas reales reconocibles.** Evita “testimonios” falsos de gente real.
- **Key del cliente** (decisión 2026-11-16): cada negocio paga su generación. Sin cifras de costo inventadas: se informa que lo cobra el proveedor.
- **El prompt es determinista** (`sceneVideoPrompt` en `src/lib/videoGen/index.ts`), sin una llamada extra a un LLM; lo que ve el usuario en la caja es exactamente lo que se envía.

## Proveedores (estado al 2026-11-21)

| Proveedor | Modelo por defecto | Por qué |
|---|---|---|
| **Google Gemini** (`gemini`) | `gemini-omni-1.2-flash` | Reutiliza la key de Gemini que el negocio ya usa para revisar tomas. Clips 3–15 s con audio nativo, 9:16. Una llamada síncrona. |
| **fal.ai** (`fal`) | `fal-ai/kling-video/o3/standard/text-to-video` | Una sola key para muchos modelos (Kling, Seedance…). Cambiar de modelo = cambiar el id. Cola asíncrona con sondeo. |

Descartados / retirados:
- **OpenAI Sora 2**: la Videos API se apagó el **2026-09-24** sin reemplazo directo.
- **Veo 3.1 preview** en la Gemini API: retirado el **2026-10-22**; Google recomienda Gemini Omni Flash (o Veo GA en su plataforma empresarial).

Este mercado cambia cada pocos meses: por eso la app nunca llama a un modelo directamente.

## Cómo cambiarlo

De menos a más esfuerzo:

1. **Un negocio quiere otro modelo** → *Negocio → Inteligencia artificial → Video con IA → Modelo*: escribe el id (hay sugerencias). Sin deploy.
2. **Mover a todos los negocios que no eligieron modelo** → variable de entorno en el servidor `VIDEO_AI_DEFAULT_MODEL_<PROVEEDOR>` (p. ej. `VIDEO_AI_DEFAULT_MODEL_FAL=fal-ai/seedance-2/fast/text-to-video`) y reiniciar. Sin cambio de código.
3. **Cambiar el modelo recomendado** → `defaultModel` / `suggestedModels` en `src/lib/videoGen/providers/<id>.ts`.
4. **Agregar un proveedor nuevo** → un archivo `src/lib/videoGen/providers/<id>.ts` que implemente `VideoGenProvider` (`src/lib/videoGen/types.ts`: `generate`, `checkKey`, `clampDuration`, textos de la key) y una línea en `VIDEO_PROVIDERS` (`src/lib/videoGen/index.ts`). Ajustes, el botón por escena y el job lo toman de esa lista. Agregar sus pruebas en `tests/videoGen.test.ts` con `fetch` simulado.

Si un proveedor cambia el formato de respuesta, el lugar a tocar es su archivo en `providers/`; nada más en la app conoce su API.

## Piezas

| Archivo | Rol |
|---|---|
| `src/lib/videoGen/types.ts` | Contrato `VideoGenProvider`, `VideoGenError` (mensajes que ve el usuario). |
| `src/lib/videoGen/index.ts` | Registro, `resolveVideoModel` (negocio → env → default), `sceneVideoPrompt`. |
| `src/lib/videoGen/credentials.ts` | Key y modelo efectivos del negocio (Gemini reutiliza la key de revisión). |
| `src/lib/videoGen/providers/*.ts` | Un archivo por proveedor. |
| `src/lib/jobs/generateTake.ts` | Job en segundo plano: genera → límites de uso → guarda → pasa a `processSceneTake`. |
| `content-actions.ts → generateTakeWithAi` | Acción del botón por escena; `retryTake` regenera si el clip nunca llegó. |
| `settings/VideoAiForm.tsx`, `settings/video-ai-actions.ts` | Configuración (solo dueño), con verificación de key y auditoría. |

Datos: `Business.videoAiProvider|videoAiKeyEncrypted|videoAiModel` y `SceneTake.source ("upload" | "ai")|aiPrompt|aiModel`; estado nuevo de toma `generating` (migración `20261123120000_video_ai`). Los minutos generados cuentan en el límite mensual de video como cualquier toma.

## Skills de Claude Code instaladas para esto

Vendorizadas en `.claude/skills/` (la CLI `npx skills add` exige Node 22; el equipo usa Node 20, por eso se versionan en git):

| Skill | Fuente | Para qué sirve aquí |
|---|---|---|
| `fal-shot-craft` | fal-ai-community/skills (MIT) | Escribir/mejorar el prompt de un plano: acción física, cámara, continuidad. Base para afinar `sceneVideoPrompt`. |
| `fal-prompting` | fal-ai-community/skills | Cómo escribir prompts por familia de modelo (Kling, etc.). |
| `model-routing` | fal-ai-community/skills | Elegir modelo por rol cuando toque cambiar el default. |
| `fal-video-generation` | fal-ai-community/skills | Generar/transformar clips (imagen→video, extender, reestilizar). |
| `ugc` | fal-ai-community/skills | Videos verticales cortos tipo creador/UGC: el formato exacto de este producto. |
| `genmedia` | fal-ai-community/skills | CLI para probar modelos, esquemas y precios desde la terminal antes de cambiar un default. |
| `remotion-best-practices` (+ captions, render, saas…) | remotion-dev/remotion `packages/skills` | Si el armado pasa de ffmpeg a plantillas React (subtítulos animados, intros de marca). Ojo: Remotion requiere licencia de empresa por encima de cierto tamaño (ver `remotion-license`). |

Para actualizarlas: clonar los repos y copiar las carpetas otra vez (o, con Node 22, `npx skills add fal-ai-community/skills` / `npx skills add remotion-dev/skills`).

## Pendiente

- Probar con keys reales de Gemini y fal en 5–10 escenas y comparar calidad y costo antes de recomendar uno por defecto en el onboarding.
- Imagen → video (animar la foto del producto del perfil): el contrato ya admite añadir el campo; falta UI.
- Si Remotion entra al armado, evaluar la licencia antes.
