import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const expectedSha =
  process.argv[2] || 'eef0624ec9f7fcc74a02a71a11c4b829addae73899d18f03335252c2da693a47';
const pdfPath = path.resolve('public/assets/Jun_Nagaoka_Resume_2027.pdf');
const buf = await readFile(pdfPath);
const sha = createHash('sha256').update(buf).digest('hex');
const ok = sha === expectedSha;
console.log(JSON.stringify({ pdfPath, sha256: sha, expectedSha, bytesUnchanged: ok }));
process.exit(ok ? 0 : 1);
