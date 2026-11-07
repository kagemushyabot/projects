# WIP home preview (Cursor publish)

Static slice of the Astro site for hosted preview under the 50MB pack limit. Omits `public/assets/wp-import/`.

Refresh after source changes:

```bash
node scripts/sync-wip-preview.mjs
```

Then commit `wip-preview/` and republish via Cursor.
