import type { Insight } from "@/lib/insights";
import type { PageActivity } from "@/lib/pageActivity";

const INACTIVITY_THRESHOLD_DAYS = 14;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Only derives insights from data actually available today. Facebook Page
// likes/comments are excluded (gated behind Meta's Advanced Access), but
// Instagram exposes like/comment counts under just instagram_basic — see
// fetchInstagramMedia in lib/meta.ts.
export function generateRealInsights(
  pages: PageActivity[],
  products: { name: string }[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const usablePages = pages.filter((p) => !p.error);

  for (const page of usablePages) {
    if (page.posts.length === 0) continue;
    const daysSinceLast = Math.floor(daysBetween(now, new Date(page.posts[0].createdTime)));
    if (daysSinceLast >= INACTIVITY_THRESHOLD_DAYS) {
      insights.push({
        kind: "problem",
        emoji: "⚠️",
        title: "Problema",
        description: `No has publicado en "${page.pageName}" desde hace ${daysSinceLast} días.`,
        recommendation: "Publica contenido esta semana para mantener a tu audiencia activa.",
        actionLabel: "Crear campaña",
        potential: "Medio",
      });
    }
  }

  const allPosts = usablePages.flatMap((page) =>
    page.posts.map((post) => ({ ...post, pageName: page.pageName }))
  );

  const mostShared = allPosts
    .filter((post) => post.shares > 0)
    .sort((a, b) => b.shares - a.shares)[0];

  if (mostShared) {
    insights.push({
      kind: "opportunity",
      emoji: "🔥",
      title: "Oportunidad",
      description: `Tu publicación "${truncate(mostShared.message ?? "(sin texto)", 80)}" en ${mostShared.pageName} fue compartida ${mostShared.shares} veces — la más compartida entre tus publicaciones recientes.`,
      recommendation: "Crea una campaña o publicación similar para capitalizar ese interés.",
      actionLabel: "Crear campaña",
      potential: "Alto",
    });
  }

  const instagramPosts = usablePages
    .filter((page) => page.instagram && !page.instagram.error)
    .flatMap((page) =>
      page.instagram!.posts.map((post) => ({
        ...post,
        username: page.instagram!.username,
        engagement: post.likes + post.comments,
      }))
    );

  const mostEngagedIgPost = instagramPosts.sort((a, b) => b.engagement - a.engagement)[0];

  if (mostEngagedIgPost && mostEngagedIgPost.engagement > 0) {
    insights.push({
      kind: "opportunity",
      emoji: "🔥",
      title: "Oportunidad",
      description: `Tu publicación "${truncate(mostEngagedIgPost.caption ?? "(sin texto)", 80)}" en Instagram (@${mostEngagedIgPost.username}) tiene ${mostEngagedIgPost.likes} likes y ${mostEngagedIgPost.comments} comentarios — tu contenido con más interacción real.`,
      recommendation: "Crea una campaña o publicación similar para capitalizar ese interés.",
      actionLabel: "Crear campaña",
      potential: "Alto",
    });
  }

  for (const page of usablePages) {
    if (page.posts.length < 2) continue;
    const sorted = [...page.posts].sort(
      (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
    );
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      gaps.push(daysBetween(new Date(sorted[i].createdTime), new Date(sorted[i + 1].createdTime)));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    insights.push({
      kind: "trend",
      emoji: "💡",
      title: "Frecuencia de publicación",
      description: `En "${page.pageName}" publicas en promedio cada ${avgGap.toFixed(1)} días, basado en tus últimas ${sorted.length} publicaciones.`,
    });
  }

  if (products.length > 0 && allPosts.length > 0) {
    const messages = allPosts.map((post) => (post.message ?? "").toLowerCase());
    const mentionedAny = products.some((product) =>
      messages.some((message) => message.includes(product.name.toLowerCase()))
    );
    if (!mentionedAny) {
      insights.push({
        kind: "trend",
        emoji: "💡",
        title: "Oportunidad detectada",
        description: `Ninguna de tus publicaciones recientes menciona directamente ${products
          .slice(0, 3)
          .map((p) => p.name)
          .join(", ")}.`,
        recommendation: `Crea contenido específico sobre ${products[0].name} para atraer más interés.`,
        actionLabel: "Crear campaña",
      });
    }
  }

  return insights;
}
