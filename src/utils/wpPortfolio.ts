/** Split migrated WordPress portfolio HTML into scroll-reveal project entries. */
export function chunkPortfolioHtml(html: string, options?: { stripLegacyHero?: boolean }): string {
  let cleaned = html.trim();

  if (options?.stripLegacyHero) {
    cleaned = cleaned.replace(
      /^<h2[^>]*>\s*JUN\s+NAGAOKA\s*<\/h2>[\s\S]*?(?:<hr\s*\/?>\s*){2,}/i,
      '',
    );
  }

  const parts = cleaned.split(/(?:<hr\s*\/?>\s*){2,}/i).map((p) => p.trim()).filter(Boolean);

  return parts
    .map((part, i) => {
      const delay = (i % 8) * 45;
      return `<article class="portfolio-entry reveal" style="--reveal-delay: ${delay}ms" data-entry>${part}</article>`;
    })
    .join('\n');
}
