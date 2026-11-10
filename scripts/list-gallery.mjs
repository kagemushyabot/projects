import { buildPortfolioGallery } from '../src/utils/portfolioGallery.ts';

const { projects, dedupeReport, evilEyeReport } = buildPortfolioGallery();
console.log('evilEyeReport', evilEyeReport);
projects.forEach((p, i) => {
  console.log(
    i,
    p.id,
    JSON.stringify(p.title),
    p.layout,
    'imgs',
    p.images.length,
    'vids',
    p.videos.length,
    p.credit || '',
  );
});
console.log('--- dedupe ---');
dedupeReport.forEach((d) => console.log(d.canonicalId, d.title, d.mergedKeys));
