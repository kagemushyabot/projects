import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://127.0.0.1:4321/projects/work-experience/';

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--user-data-dir=/tmp/pptr-verify'],
});

const page = await browser.newPage();
await page.goto(base, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));

await page.evaluate(async () => {
  const imgs = Array.from(document.querySelectorAll('.gallery-image img'));
  imgs.forEach((img) => {
    img.loading = 'eager';
  });
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve(null);
          img.addEventListener('load', () => resolve(null), { once: true });
          img.addEventListener('error', () => resolve(img.src), { once: true });
        }),
    ),
  );
});

const report = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('.gallery-image img, .gallery-video-thumb img'));
  return imgs.map((img) => ({
    src: (img).getAttribute('src') || '',
    naturalWidth: (img).naturalWidth,
    naturalHeight: (img).naturalHeight,
  }));
});

const broken = report.filter((r) => r.src.includes('wp-import') && r.naturalWidth === 0);
await browser.close();

if (broken.length) {
  console.error('Broken images (naturalWidth 0):');
  broken.forEach((b) => console.error(b.src));
  process.exit(1);
}

console.log(`OK: ${report.length} thumbs, all wp-import naturalWidth > 0 (${broken.length} broken)`);
