export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: 2 de septiembre de 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <Section title="Quiénes somos">
          <p>
            MarketingAI es una herramienta que ayuda a un negocio a analizar su actividad en
            redes sociales, generar contenido y campañas con inteligencia artificial, y —cuando el
            propio negocio lo autoriza explícitamente— publicar ese contenido o pautarlo en Meta
            Ads. Este documento explica qué datos recopilamos y cómo los usamos, incluyendo los
            datos que obtenemos a través de la API de Meta (Facebook e Instagram).
          </p>
        </Section>

        <Section title="Qué datos recopilamos">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Datos del negocio:</strong> nombre, industria, descripción, audiencia
              objetivo, ubicación, ticket promedio y objetivo, ingresados por el propio usuario al
              crear su perfil.
            </li>
            <li>
              <strong>Datos de Meta (Facebook/Instagram), solo si el usuario conecta su cuenta:</strong>{" "}
              el token de acceso de su cuenta de Meta, las Páginas de Facebook que administra, su
              cuenta profesional de Instagram vinculada, publicaciones y su rendimiento público
              (compartidos, y likes/comentarios cuando el permiso lo permite), y —si conecta una
              cuenta publicitaria— su identificador, nombre y moneda.
            </li>
            <li>
              <strong>Contenido creado por el usuario:</strong> videos e imágenes que sube o que la
              IA genera a partir de sus instrucciones, y las campañas, guiones y publicaciones
              resultantes.
            </li>
            <li>
              <strong>Credenciales de IA del propio usuario:</strong> si configura su propia clave
              de API de un proveedor de IA (Anthropic u OpenAI), la guardamos cifrada y solo se usa
              para las solicitudes que el propio usuario inicia.
            </li>
            <li>
              <strong>Nombres de competidores</strong> que el usuario decide registrar, usados
              únicamente para consultar la Ad Library pública de Meta.
            </li>
          </ul>
        </Section>

        <Section title="Cómo usamos estos datos">
          <ul className="list-disc space-y-2 pl-5">
            <li>Mostrar al usuario un resumen de su propia actividad y su rendimiento real.</li>
            <li>
              Generar campañas, guiones, imágenes y recomendaciones con IA, usando el proveedor de
              IA que el propio usuario configuró.
            </li>
            <li>
              Publicar contenido en las Páginas de Facebook/Instagram que el usuario administra —
              solo cuando el usuario hace clic explícitamente en "Publicar".
            </li>
            <li>
              Crear y administrar campañas de Meta Ads a solicitud del usuario. Toda campaña se
              crea pausada; activarla, pausarla o cambiar su presupuesto requiere una acción
              explícita del usuario en cada ocasión — nunca ocurre de forma automática.
            </li>
          </ul>
        </Section>

        <Section title="Con quién compartimos datos">
          <p>
            No vendemos datos personales ni los compartimos con redes de publicidad de terceros.
            Los datos se comparten únicamente con:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Meta Platforms, Inc.</strong>, a través de su Graph API, para leer y publicar
              lo que el usuario autoriza mediante los permisos que otorga al conectar su cuenta.
            </li>
            <li>
              <strong>El proveedor de IA que el propio usuario eligió</strong> (Anthropic u OpenAI),
              únicamente para procesar el contenido específico que el usuario solicita generar.
            </li>
          </ul>
        </Section>

        <Section title="Retención y eliminación">
          <p>
            El usuario puede desconectar su cuenta de Meta en cualquier momento desde el panel de
            su negocio, lo que elimina el token de acceso y las Páginas asociadas guardadas en
            nuestra base de datos. Para solicitar la eliminación completa de los datos de un
            negocio, escríbenos a la dirección de contacto abajo.
          </p>
        </Section>

        <Section title="Seguridad">
          <p>
            Las claves de API de IA que el usuario configura se almacenan cifradas, nunca en texto
            plano. Los tokens de acceso de Meta se usan únicamente en el servidor, nunca se envían
            al navegador del usuario.
          </p>
        </Section>

        <Section title="Contacto">
          <p>
            Para preguntas sobre esta política o para solicitar la eliminación de tus datos,
            escríbenos a{" "}
            <a href="mailto:rjuandavid2002@gmail.com" className="text-brand hover:underline">
              rjuandavid2002@gmail.com
            </a>
            . Ver también las{" "}
            <a href="/terms" className="text-brand hover:underline">
              condiciones del servicio
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
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-muted">{children}</div>
    </section>
  );
}
