# Visión del producto

> Última actualización: 2026-11-16. Documento vivo — se actualiza cuando cambia una decisión de producto.

## Una frase

**Descubre qué publicar, crea mejor contenido en menos tiempo, distribúyelo constantemente y entiende qué contenido te trae clientes e ingresos.**

## El problema

El dueño de un negocio pequeño (clínica, restaurante, gimnasio, inmobiliaria, tienda…) sabe que "tiene que publicar", pero:

1. **No sabe qué publicar.** No tiene tiempo de mirar a la competencia ni de seguir tendencias.
2. **No sabe grabar ni editar.** Graba con el celular, el resultado es largo, con pausas, sin subtítulos, en el formato equivocado.
3. **No publica con constancia.** Publica cuando se acuerda.
4. **No sabe si sirve.** Ve "likes" pero no sabe si algún cliente llegó por un video. Por eso deja de invertir tiempo en contenido.

Las herramientas que existen resuelven pedazos sueltos: editores de video con IA, programadores de publicaciones, generadores de texto. Ninguna conecta *qué publicar → cómo grabarlo → editarlo → publicarlo → qué clientes trajo*.

## La solución

Un sistema integrado que recorre el ciclo completo de crecimiento por contenido:

```
Entender el negocio → Mirar mercado y competencia → Detectar oportunidades
      ↑                                                     ↓
Aprender de los resultados                      Estrategia + guion paso a paso
      ↑                                                     ↓
Medir leads, conversiones e ingresos  ←  Publicar  ←  Editar el video del cliente con IA
```

El diferenciador no es "tenemos IA". Es que **cerramos el ciclo hasta el cliente que pagó** (módulo de seguimiento de leads) y usamos ese resultado para decidir el siguiente contenido.

## Para quién (mercado objetivo)

- Pequeñas y medianas empresas con atención local o digital, de **cualquier industria**.
- Mercado inicial: Latinoamérica hispanohablante (Ecuador como primer mercado piloto).
- Quien usa el producto: el dueño o la persona "que hace las redes" (no un especialista en marketing).

Ver perfiles detallados en [PRD.md](PRD.md#perfiles-de-usuario).

## Principios del producto

1. **Independiente de la industria.** Una sola plataforma. La personalización viene del *perfil del negocio*, no de código por industria. Nada de flujos, prompts o dashboards fijos para "dental" o "restaurantes".
2. **Nunca inventar datos.** Ninguna métrica, tendencia, dato de competidor o atribución que no venga de una fuente real. Si no hay datos, se dice "no hay datos" y se explica cómo obtenerlos.
3. **Honestidad sobre las plataformas.** Solo APIs oficiales y permisos autorizados. Si una integración no existe o no está aprobada, ofrecemos exportar y publicar a mano — no prometemos lo que la API no permite.
4. **El usuario aprueba todo lo que sale.** Nada se publica (ni se gasta dinero) sin un clic explícito.
5. **Resultados de negocio > métricas de vanidad.** El dashboard prioriza "qué te trajo clientes" sobre "cuántos likes".
6. **Hecho para un fundador solo.** Arquitectura simple, pocos servicios, bajo costo operativo.

## Lo que NO somos

- No somos "otro editor de video con IA" (aunque editamos video).
- No somos "otro programador de publicaciones" (aunque publicamos).
- No somos un CRM (registramos leads, no gestionamos ventas complejas).
- No somos una agencia de pauta — la pauta pagada está **congelada** hasta revisar el negocio.

## Modelo comercial (estado actual)

- Plan único ≈ **USD 99–100/mes** por cuenta. Cobro manual por transferencia; el administrador habilita/deshabilita cuentas desde `/admin`.
- **Cada cliente paga su propia IA** (trae su API key de Anthropic / OpenAI; Google Gemini planeado). Decisión del 2026-11-16: la plataforma no absorbe costos de IA por ahora. Consecuencia: nuestro costo variable por cliente es casi solo almacenamiento y CPU de video.
- Pasarela de pago y límites de uso: después de validar disposición a pagar (ver [VALIDATION_PLAN.md](VALIDATION_PLAN.md)).

## Cómo sabremos que funciona

- Un negocio real publica contenido **cada semana** usando el sistema durante 2+ meses.
- Puede señalar **al menos un cliente** atribuido a un enlace/QR/código de una campaña.
- Paga el segundo mes sin que se lo insistamos.
