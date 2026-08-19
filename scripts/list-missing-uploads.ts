/**
 * Reports every file the database still references that is no longer on disk.
 *
 *   npx ts-node -T scripts/list-missing-uploads.ts            # summary
 *   npx ts-node -T scripts/list-missing-uploads.ts --full     # every path
 *   npx ts-node -T scripts/list-missing-uploads.ts --csv > missing.csv
 *
 * Read-only. Written after a deploy wiped /uploads (rsync --delete with the
 * directory gitignored, so it was never in the source) — the rows survived, the
 * files did not, and this produces the re-upload list.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma';

const UPLOADS_ROOT = path.join(__dirname, '../uploads');
const FULL = process.argv.includes('--full');
const CSV = process.argv.includes('--csv');

/** Every table/column pair that stores an uploaded file path. */
const SOURCES: { label: string; model: string; column: string; labelColumn?: string }[] = [
  { label: 'Application documents', model: 'userDocument', column: 'fileUrl', labelColumn: 'fileName' },
  { label: 'Utilisation documents', model: 'utilisationDocument', column: 'fileUrl', labelColumn: 'fileName' },
  { label: 'Pitch decks', model: 'pitchDeckSubmission', column: 'filePath', labelColumn: 'fileName' },
  { label: 'Media gallery', model: 'webMedia', column: 'url', labelColumn: 'originalName' },
  { label: 'Startup logos', model: 'webStartup', column: 'logoPath', labelColumn: 'name' },
  { label: 'Team photos', model: 'webTeamMember', column: 'photo', labelColumn: 'name' },
  { label: 'Board photos', model: 'webBoardMember', column: 'photo', labelColumn: 'title' },
  { label: 'Inventory images', model: 'webInventoryItem', column: 'imagePath', labelColumn: 'name' },
  { label: 'Event cover images', model: 'event', column: 'coverImage', labelColumn: 'title' },
];

function existsOnDisk(webPath: string) {
  const clean = String(webPath).replace(/^\/+/, '');
  if (!clean.startsWith('uploads/')) return true; // external URL — not ours to check
  return fs.existsSync(path.join(UPLOADS_ROOT, clean.slice('uploads/'.length)));
}

async function main() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    console.log(`uploads directory does not exist at ${UPLOADS_ROOT}\n`);
  }

  const missing: { group: string; label: string; file: string }[] = [];
  let checked = 0;

  for (const src of SOURCES) {
    const client = (prisma as any)[src.model];
    if (!client) {
      console.log(`  (skipped ${src.label} — no such model)`);
      continue;
    }

    let rows: any[] = [];
    try {
      // No `where` filter: Prisma rejects `{ not: null }` on non-nullable
      // columns, and these tables are small enough to filter in memory.
      rows = await client.findMany({
        select: { id: true, [src.column]: true, ...(src.labelColumn ? { [src.labelColumn]: true } : {}) },
      });
    } catch (err: any) {
      console.log(`  (skipped ${src.label} — ${err?.message?.split('\n')[0]})`);
      continue;
    }

    for (const row of rows) {
      const value = row[src.column];
      if (!value) continue;
      checked++;
      if (!existsOnDisk(value)) {
        missing.push({
          group: src.label,
          label: String(row[src.labelColumn as string] ?? row.id),
          file: String(value),
        });
      }
    }
  }

  if (CSV) {
    console.log('Category,Belongs to,Missing file');
    for (const m of missing) {
      console.log(`"${m.group}","${m.label.replace(/"/g, '""')}","${m.file}"`);
    }
  } else {
    console.log(`\nChecked ${checked} referenced files. Missing: ${missing.length}\n`);
    const byGroup = new Map<string, typeof missing>();
    for (const m of missing) {
      if (!byGroup.has(m.group)) byGroup.set(m.group, []);
      byGroup.get(m.group)!.push(m);
    }
    for (const [group, items] of byGroup) {
      console.log(`${group}: ${items.length} missing`);
      const show = FULL ? items : items.slice(0, 5);
      for (const i of show) console.log(`   - ${i.label}  →  ${i.file}`);
      if (!FULL && items.length > show.length) {
        console.log(`   … and ${items.length - show.length} more (run with --full)`);
      }
      console.log('');
    }
    if (!missing.length) console.log('Nothing missing — every referenced file is on disk.\n');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
