import { buildPortfolioGallery } from '../src/utils/portfolioGallery.ts';

const { projects, layoutReport } = buildPortfolioGallery();
console.log(JSON.stringify({ myvrRemoved: layoutReport.myvrPanelsRemoved, ids: projects.map((p) => p.id) }, null, 2));
const mar = projects.find((p) => p.id.includes('marvel'));
console.log('marvel video', mar?.videos?.[0]?.youtubeId);
