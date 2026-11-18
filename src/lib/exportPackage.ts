// Text inside the "paquete de publicación" zip (pure, tested).

export function packageFileName(label: string): string {
  if (/9:16/.test(label)) return "vertical-9x16";
  if (/4:5/.test(label)) return "feed-4x5";
  if (/1:1/.test(label)) return "cuadrado-1x1";
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "video";
}

export function buildPackageReadme(input: {
  title: string;
  business: string;
  caption: string;
  versions: { file: string; label: string }[];
  platformCopy: { label: string; titulo: string; caption: string; hashtags: string[]; nota: string }[];
}): string {
  const lines: string[] = [
    `${input.title}`,
    `${input.business}`,
    "",
    "ARCHIVOS",
    ...input.versions.map((v) => `- ${v.file}: ${v.label}`),
    "",
    "QUÉ FORMATO USAR",
    "- TikTok, Reels y YouTube Shorts: vertical 9:16.",
    "- Feed de Instagram y Facebook: 4:5.",
    "- Anuncios y redes con formato cuadrado: 1:1.",
    "",
    "TEXTO DE LA PUBLICACIÓN",
    input.caption || "(sin texto)",
  ];
  for (const c of input.platformCopy) {
    lines.push("", `TEXTO PARA ${c.label.toUpperCase()}`);
    if (c.titulo) lines.push(`Título: ${c.titulo}`);
    lines.push(c.caption);
    if (c.hashtags.length > 0) lines.push("", c.hashtags.join(" "));
    if (c.nota) lines.push("", `Consejo: ${c.nota}`);
  }
  lines.push("", "Cuando lo publiques, márcalo como publicado en MarketingAI (Publicaciones) y pega el enlace.");
  return lines.join("\n") + "\n";
}
