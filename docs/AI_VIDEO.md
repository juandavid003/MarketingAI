# Video con IA

> 2026-11-22. Cómo genera la app escenas con IA, qué IA conviene para cada caso y cómo cambiarla mañana.

## Qué hace

En cada escena de un guion (*Contenido → Guiones → guion*), además de **Subir toma**, el dueño o encargado puede **“Generar con IA”**:

1. **Elegir con qué IA.** El selector muestra todas; las que no tienen key aparecen deshabilitadas. Viene preseleccionada la **recomendada para esa escena** (`src/lib/videoGen/recommend.ts`) con el porqué, y si otra que falta daría mejor resultado, lo dice. En Configuración se puede fijar una preferida en vez de la automática.
2. **Revisar qué se ve y qué dice la voz** (dos cajas editables, armadas del guion).
3. Opcional: **“Mejorar con Claude”** (o GPT: la IA de texto del negocio) reescribe la descripción como la leen mejor los modelos de imagen y video: un sujeto, una acción, cámara, luz. No genera nada, solo propone el texto.
4. **Generar.** El clip **entra como una toma más**: se le quitan silencios, se transcribe, se revisa y se arma con las demás escenas (subtítulos, hook, logo, 9:16 / 4:5 / 1:1). La toma muestra “Generada con IA”. Creativos, calendario y publicaciones no distinguen si una escena se grabó o se generó.

Decisiones:
- **La IA rellena escenas, no reemplaza el flujo.** Grabar sigue siendo lo principal (más barato y más auténtico).
- **Sin texto en el clip.** Textos y logo los pone el armado en el color de marca.
- **Narrador fuera de cámara, sin personas reales reconocibles.** Evita “testimonios” falsos.
- **Keys del cliente** (decisión 2026-11-16). Sin cifras de costo inventadas: se informa que lo cobra el proveedor.
- **Recomendaciones editoriales, no métricas:** reglas según cómo funciona cada opción (movimiento real o foto con movimiento de cámara, sonido propio o no), siempre con el motivo visible.
- **Prompt determinista** (`sceneVideoPrompt` en `src/lib/videoGen/prompt.ts`): lo que se ve en las cajas es exactamente lo que se envía.

## Proveedores (estado al 2026-11-22)

| Proveedor | Key que usa | Modelo por defecto | Bueno para |
|---|---|---|---|
| **OpenAI imagen + movimiento + voz** (`openai`) | cualquier key de OpenAI ya guardada (texto, imágenes o transcripción) | `gpt-image-2` + voz `gpt-4o-mini-tts` | Producto, platos, local, detalles. Imagen vertical con movimiento de cámara (ffmpeg) y voz IA. **No muestra acción.** Es lo que funciona con solo Claude + OpenAI. |
| **Google Gemini** (`gemini`) | la key de Gemini de la revisión visual | `gemini-omni-1.2-flash` | Movimiento real con sonido propio, 3–15 s. |
| **fal.ai** (`fal`) | key propia de fal | `fal-ai/kling-video/o3/standard/text-to-video` | Varios modelos con una key; Kling cuida más personas y manos. |

**Combinación recomendada** (Configuración la muestra marcando lo que el negocio ya tiene):

| Trabajo | Recomendada |
|---|---|
| Guiones, hooks y textos por red | Claude (OpenAI también sirve) |
| Subtítulos y revisión de lo dicho | OpenAI Whisper |
| Revisión visual de tomas | Gemini |
| Escenas IA con acción o personas | Kling (fal) o Gemini Omni |
| Escenas IA de producto, platos o lugar | OpenAI imagen + movimiento |

Más una guía corta por red (Reels, TikTok, Shorts, Facebook) en `PLATFORM_TIPS`.

Descartados / por vencer:
- **OpenAI Sora 2**: la Videos API se apagó el **2026-09-24** sin reemplazo directo. Por eso “OpenAI” aquí es imagen + movimiento, no video.
- **Veo 3.1 preview** en la Gemini API: retirado el **2026-10-22**; Google recomienda Gemini Omni Flash.
- **TTS de OpenAI** (`gpt-4o-mini-tts`): se apaga el **2027-01-06** y OpenAI aún no nombra reemplazo para este endpoint. Cambiarlo es `OPENAI_TTS_MODEL` en el servidor; `src/lib/videoGen/openaiSpeech.ts` es el único archivo que lo conoce.

Este mercado cambia cada pocos meses: por eso la app nunca llama a un modelo directamente.

## Cómo cambiarlo

De menos a más esfuerzo:

1. **Un negocio quiere otro modelo** → *Negocio → Inteligencia artificial → Video con IA*: cada proveedor tiene su campo *Modelo* (con sugerencias). Sin deploy.
2. **Mover a todos los negocios que no eligieron modelo** → variable `VIDEO_AI_DEFAULT_MODEL_<PROVEEDOR>` (ver `deploy/env.example`) y reiniciar. Sin cambio de código.
3. **Cambiar el modelo recomendado** → `defaultModel` / `suggestedModels` en `src/lib/videoGen/providers/<id>.ts`.
4. **Cambiar qué se recomienda** → puntajes y motivos en `src/lib/videoGen/recommend.ts` (con sus pruebas).
5. **Agregar un proveedor** → un archivo `src/lib/videoGen/providers/<id>.ts` que implemente `VideoGenProvider` (`types.ts`: `generate`, `clampDuration`, `keySource`, `strengths`, `realMotion`), una línea en `VIDEO_PROVIDERS` (`index.ts`), su puntaje en `recommend.ts` y, si usa una key nueva, su campo en `Business` y en `credentials.ts`. Pruebas en `tests/videoGen.test.ts` con `fetch` simulado.

Si un proveedor cambia el formato de respuesta, el lugar a tocar es su archivo en `providers/`.

## Piezas

| Archivo | Rol |
|---|---|
| `src/lib/videoGen/types.ts` | Contrato `VideoGenProvider`, `VideoGenError` (mensajes que ve el usuario). |
| `src/lib/videoGen/index.ts` | Registro, modelos por proveedor, `resolveVideoModel` (negocio → env → default). |
| `src/lib/videoGen/prompt.ts` | `sceneVideoPrompt` (qué se ve + voz), `promptWithNarration` para modelos con sonido propio. |
| `src/lib/videoGen/recommend.ts` | Recomendación por escena y red, combinación recomendada, guía por red. |
| `src/lib/videoGen/credentials.ts` | Qué key usa cada proveedor y cuáles tiene el negocio. |
| `src/lib/videoGen/providers/*.ts` | Un archivo por proveedor. |
| `src/lib/videoGen/stillMotion.ts`, `openaiSpeech.ts` | Movimiento de cámara (ffmpeg) y voz TTS del proveedor OpenAI. |
| `src/lib/jobs/generateTake.ts` | Job en segundo plano: genera → límites de uso → guarda → `processSceneTake`. |
| `content-actions.ts → generateTakeWithAi`, `improveScenePrompt` | Generar con la IA elegida; “Mejorar con Claude/GPT”. `retryTake` regenera si el clip nunca llegó. |
| `settings/VideoAiForm.tsx`, `settings/video-ai-actions.ts` | Configuración (solo dueño), con verificación de key y auditoría. |

Datos: `Business.videoAiProvider` (preferida; vacío = automática), `falApiKeyEncrypted`, `videoAiModels` (JSON por proveedor); `SceneTake.source ("upload" | "ai")`, `aiPrompt`, `aiNarration`, `aiModel` (`"proveedor:modelo"`); estado de toma `generating`. Migraciones `20261123120000_video_ai` y `20261124120000_video_ai_providers`. Los minutos generados cuentan en el límite mensual como cualquier toma.

## Skills de Claude Code instaladas para esto

Vendorizadas en `.claude/skills/` (la CLI `npx skills add` exige Node 22; el equipo usa Node 20, por eso se versionan en git):

| Skill | Fuente | Para qué sirve aquí |
|---|---|---|
| `fal-shot-craft` | fal-ai-community/skills (MIT) | Escribir/mejorar el prompt de un plano: acción física, cámara, continuidad. Base de “Mejorar con Claude”. |
| `fal-prompting` | fal-ai-community/skills | Cómo escribir prompts por familia de modelo (Kling, GPT Image…). |
| `model-routing` | fal-ai-community/skills | Elegir modelo por rol cuando toque cambiar el default. |
| `fal-video-generation` | fal-ai-community/skills | Generar/transformar clips (imagen→video, extender, reestilizar). |
| `ugc` | fal-ai-community/skills | Videos verticales cortos tipo creador/UGC: el formato de este producto. |
| `genmedia` | fal-ai-community/skills | CLI para probar modelos, esquemas y precios antes de cambiar un default. |
| `remotion-best-practices` (+ captions, render, saas…) | remotion-dev/remotion `packages/skills` | Si el armado pasa de ffmpeg a plantillas React. Remotion requiere licencia de empresa por encima de cierto tamaño (`remotion-license`). |

Para actualizarlas: clonar los repos y copiar las carpetas otra vez (o, con Node 22, `npx skills add fal-ai-community/skills` / `npx skills add remotion-dev/skills`).

## Pendiente

- Probar con keys reales: OpenAI primero (es lo que tiene el fundador, 2026-11-22); Gemini y fal con el primer cliente que las tenga. Ajustar `recommend.ts` con lo que se vea.
- Imagen → video real (animar la foto del producto con Kling/Gemini): falta el campo de imagen en el contrato y la UI.
- Reemplazo del TTS de OpenAI antes del 2027-01-06.
- Si Remotion entra al armado, evaluar la licencia antes.
