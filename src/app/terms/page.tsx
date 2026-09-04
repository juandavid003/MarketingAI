export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">AI Growth OS</p>
      <h1 className="mt-1 text-2xl font-semibold">Condiciones del servicio</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Última actualización: 4 de septiembre de 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <Section title="Qué es AI Growth OS">
          <p>
            AI Growth OS es una herramienta que ayuda a un negocio a analizar su actividad en
            redes sociales, generar contenido y campañas con inteligencia artificial y, cuando el
            propio negocio lo autoriza explícitamente, publicar ese contenido o pautarlo en Meta
            Ads. Al usar la app aceptas estas condiciones.
          </p>
        </Section>

        <Section title="Tu cuenta y lo que conectas">
          <p>
            Eres responsable de la información que ingresas sobre tu negocio, de las cuentas de
            Meta (Facebook/Instagram) y de las cuentas publicitarias que conectas, y de las claves
            de API de proveedores de IA (Anthropic u OpenAI) que configuras con tu propia cuenta.
            Solo debes conectar cuentas y Páginas que tú mismo administras.
          </p>
        </Section>

        <Section title="Contenido generado por IA">
          <p>
            El contenido, copys, imágenes y guiones que la IA genera son sugerencias. Antes de
            publicarlos o de pautarlos como anuncio, eres responsable de revisarlos y de que
            cumplan con la ley y con las políticas de la plataforma donde los publiques (Meta
            incluida).
          </p>
        </Section>

        <Section title="Publicaciones y campañas pagadas">
          <p>
            La app nunca publica contenido en tus redes ni crea una campaña de Meta Ads sin una
            acción tuya explícita. Toda campaña publicitaria que la app crea empieza pausada — tú
            decides cuándo activarla, pausarla o cambiar su presupuesto. Eres el único responsable
            del gasto publicitario que autorices en tu cuenta de Meta Ads; nosotros no gestionamos
            ni tenemos acceso a tu método de pago.
          </p>
        </Section>

        <Section title="Servicios de terceros">
          <p>
            El uso de Meta (Facebook/Instagram/Meta Ads) a través de esta app está sujeto también a
            las condiciones de Meta Platforms, Inc. El uso de un proveedor de IA con tu propia
            clave de API está sujeto a las condiciones de ese proveedor. No somos responsables de
            cambios, interrupciones o decisiones de esos servicios de terceros.
          </p>
        </Section>

        <Section title="Uso aceptable">
          <p>
            No debes usar la app para generar o publicar contenido ilegal, engañoso, o que infrinja
            derechos de terceros, ni para violar las políticas de Meta u otras plataformas.
          </p>
        </Section>

        <Section title="Sin garantías">
          <p>
            La app se ofrece "tal cual". No garantizamos resultados específicos de las campañas ni
            que el contenido generado por IA esté siempre libre de errores.
          </p>
        </Section>

        <Section title="Cambios a estas condiciones">
          <p>
            Podemos actualizar estas condiciones ocasionalmente. Si hay cambios importantes, lo
            indicaremos en esta misma página con la fecha de actualización.
          </p>
        </Section>

        <Section title="Contacto">
          <p>
            Para preguntas sobre estas condiciones, escríbenos a{" "}
            <a href="mailto:rjuandavid2002@gmail.com" className="underline">
              rjuandavid2002@gmail.com
            </a>
            . Ver también la{" "}
            <a href="/privacy" className="underline">
              política de privacidad
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
