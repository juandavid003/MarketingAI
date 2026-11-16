# Flujos del producto y recorridos de usuario

> Última actualización: 2026-11-16. ✅ = funciona hoy · ⬜ = planeado.

## Mapa general

```
Registro ─► Habilitación (admin) ─► Onboarding del negocio ─► Configurar IA + conectar Meta
                                                   │
                                                   ▼
                ┌──────────── Ciclo semanal ──────────────┐
                │ 1. Ver oportunidades (datos reales)      │
                │ 2. Elegir/crear campaña o plan semanal   │
                │ 3. Guion escena por escena               │
                │ 4. Grabar con el celular                 │
                │ 5. Subir → edición IA → revisar          │
                │ 6. Publicar (o exportar) con aprobación  │
                │ 7. Enlace/QR/código en la publicación    │
                │ 8. Registrar leads y ventas              │
                │ 9. Ver qué trajo clientes → siguiente    │
                └──────────────────────────────────────────┘
```

## Recorrido 1 — Alta de un cliente nuevo

1. ✅ El cliente se registra en `/signup` (o el admin le crea la cuenta). La cuenta nace **deshabilitada** y ve `/pending`.
2. ✅ Transfiere el pago. El admin entra a `/admin` y pulsa **Habilitar**.
3. ✅ El cliente entra a `/onboarding` y crea su negocio con los datos básicos.
4. ⬜ Completa el **perfil del negocio** (tono, colores, CTAs, contacto, personas…) — se puede saltar y volver después; el sistema avisa qué campos mejoran los resultados.
5. ✅ En **Configuración** pega su API key de IA (Anthropic u OpenAI) y, si quiere video, su key de OpenAI para transcripción.
6. ✅ Conecta Facebook/Instagram (OAuth de Meta) y elige páginas.

**Resultado esperado:** en < 15 minutos, el negocio tiene perfil, IA y redes conectadas.

## Recorrido 2 — "¿Qué publico esta semana?"

1. ✅ En el panel del negocio ve **Tu negocio esta semana**: oportunidades derivadas de su actividad real (inactividad, publicación con más interacción, productos que nunca menciona, frecuencia).
2. ✅ Si no tiene redes conectadas: **no se muestran ejemplos inventados**; ve un estado vacío explicando qué conectar, y puede igual pedir una campaña por objetivo.
3. ✅ Crea una campaña desde una oportunidad o escribiendo su objetivo ("Quiero vender más blanqueamientos").
4. ⬜ (Sprint 3) Pide el **plan semanal**: 3–5 piezas con pilar, propósito, día sugerido, formato y hook.

## Recorrido 3 — De guion a video publicado

1. ✅ En la campaña, por cada pieza pulsa **Generar storyboard y guion**: escenas con qué decir, qué mostrar, plano y duración.
2. El cliente graba con el celular siguiendo el guion.
3. ✅ Sube el video en **Videos → Subir video**.
4. ⬜→✅ (Sprint 1) La subida responde de inmediato; el video se procesa **en segundo plano** (transcribir → analizar → renderizar). La página muestra el estado y se actualiza sola. Si falla o el servidor se reinicia, aparece **Reintentar**.
5. ✅ Resultado: clip vertical con subtítulos, hook y CTA sugeridos, miniatura, botón de descarga.
6. ⬜ (Sprint 3) Si el análisis detecta problemas (mala luz, audio, falta una escena del guion), muestra **"Te recomendamos volver a grabar la escena X porque…"**.
7. ✅ Publica en una Página de Facebook (clic explícito). ⬜ Instagram / programación / paquete de exportación para TikTok y YouTube (Sprint 4).

## Recorrido 4 — Seguimiento de leads (Sprint 2)

1. En la campaña (o en **Resultados**), crea un **enlace rastreable**: destino (WhatsApp, web, formulario), etiqueta, UTM automáticos. Obtiene URL corta + **QR** descargable.
2. Opcional: crea un **código promocional** para la campaña ("BLANCO10").
3. Pone el enlace en la bio/caption, el QR en el local, el código en el video.
4. Cada visita al enlace se cuenta (fecha, enlace; sin datos personales) y redirige al destino con sus UTM.
5. Cuando llega un cliente, el negocio lo **registra**: nombre/contacto, origen (enlace X / código Y / "dijo que vio el video" / no sabe), estado y valor de la venta.
6. El panel de **Resultados** muestra en dos bloques separados:
   - *Reportado por las plataformas* (alcance, interacción).
   - *Resultados de negocio* (clics a enlaces, leads, clientes, ingresos), con el origen y la **confianza** de cada atribución: *rastreado* (enlace/código) vs *declarado* (lo dijo el cliente) vs *desconocido*.

## Recorrido 5 — Admin

1. ✅ `/admin` lista clientes, correos, negocios, botón Habilitar/Deshabilitar.
2. ⬜ Ver uso por cliente (videos procesados, almacenamiento) — Sprint 6.

## Estados del video

```
uploaded ──► transcribing ──► analyzing ──► rendering ──► ready
    │              │              │             │
    └──────────────┴──────────────┴─────────────┴──► error (con mensaje) ──► [Reintentar] ──► uploaded
```

Un video en un estado intermedio por más de 30 minutos se considera interrumpido y ofrece **Reintentar**.

## Estados del lead (Sprint 2)

```
nuevo ──► contactado ──► cliente (con valor de venta)
   └──────────┴────────► perdido
```
