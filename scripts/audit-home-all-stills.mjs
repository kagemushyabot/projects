import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditHomeSlideshowAllStills } from '../src/utils/homeChaosCollage.ts';

const outPath = process.argv[2];
if (!outPath) {
  console.error('usage: npx vite-node scripts/audit-home-all-stills.mjs <out.json>');
  process.exit(1);
}

const audit = auditHomeSlideshowAllStills();
const payload = {
  generatedAt: new Date().toISOString(),
  ...audit,
  summary: {
    includedStillsCount: audit.includedStillsCount,
    galleryStillInventoryUniqueCount: audit.galleryStillInventoryUniqueUrls.length,
    zeroMissingStills: audit.zeroMissingStills,
    zeroVideoPosters: audit.zeroVideoPosters,
    inventoryMatch: audit.inventoryMatch,
  },
};

await writeFile(path.resolve(outPath), JSON.stringify(payload, null, 2));
const ok = audit.inventoryMatch && audit.zeroVideoPosters;
console.log(
  JSON.stringify({
    ok,
    included: audit.includedStillsCount,
    inventoryUnique: audit.galleryStillInventoryUniqueUrls.length,
  }),
);
process.exit(ok ? 0 : 1);
