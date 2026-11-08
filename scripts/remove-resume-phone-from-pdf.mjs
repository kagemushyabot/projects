/**
 * Remove phone number from Jun_Nagaoka_Resume_2027.pdf (redact visible glyphs; keep contact line).
 * Run: node scripts/remove-resume-phone-from-pdf.mjs
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = path.resolve(__dirname, '../public/assets/Jun_Nagaoka_Resume_2027.pdf');

const py = `
import fitz
import shutil
import sys

path = sys.argv[1]
doc = fitz.open(path)
page = doc[0]
target = "415-314-0625  ·  "
rects = page.search_for(target)
if not rects:
    raise SystemExit("phone segment not found in PDF")
for r in rects:
    page.add_redact_annot(r, fill=(1, 1, 1))
page.apply_redactions()
tmp = path + ".tmp"
doc.save(tmp)
doc.close()
shutil.move(tmp, path)
text = fitz.open(path)[0].get_text()
if "415-314-0625" in text or "415-314" in text:
    raise SystemExit("phone still present in PDF text layer")
`;

const before = createHash('sha256').update(readFileSync(pdfPath)).digest('hex');
const run = spawnSync('python3', ['-c', py, pdfPath], { encoding: 'utf8' });
if (run.status !== 0) {
  console.error(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}
const after = createHash('sha256').update(readFileSync(pdfPath)).digest('hex');
console.log(JSON.stringify({ pdfPath, sha256Before: before, sha256After: after }, null, 2));
