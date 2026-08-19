// @ts-nocheck
import ExcelJS from 'exceljs';
import prisma from '../../../lib/prisma';

/**
 * Bulk import of website startup profiles from a spreadsheet.
 *
 * Nested fields are flattened into columns (funding_*, regulatory_*, team),
 * because a spreadsheet has no way to express JSON. They are reassembled here.
 * Logos are deliberately absent — an image cannot travel in a cell, so those
 * are uploaded per startup afterwards.
 */

interface ColumnDef {
  key: string;          // column header in the sheet
  label: string;        // human hint shown on the Instructions sheet
  example?: string;
  width?: number;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Required. Startup name.', example: 'Acme Robotics', width: 26 },
  { key: 'logoEmoji', label: 'Optional emoji shown when no logo is uploaded.', example: '🤖', width: 10 },
  { key: 'sector', label: 'Must match a sector from Master data — unknown values are reported so a typo does not break site filters.', example: 'Manufacturing', width: 18 },
  { key: 'stage', label: 'One of: Ideation, Validation, Early Traction, Scaling, Revenue.', example: 'Early Traction', width: 16 },
  { key: 'ecosystem', label: 'Which centre or programme.', example: 'GTU Ventures', width: 18 },
  { key: 'registered', label: 'Year of registration.', example: '2024', width: 12 },
  { key: 'email', label: 'Contact email.', example: 'founder@acme.com', width: 24 },
  { key: 'phone', label: 'Contact phone.', example: '9876543210', width: 16 },
  { key: 'website', label: 'Full URL.', example: 'https://acme.com', width: 24 },
  { key: 'businessModel', label: 'B2B / B2C / B2G etc.', example: 'B2B', width: 14 },
  { key: 'problem', label: 'Problem being solved.', example: 'Manual inspection is slow', width: 34 },
  { key: 'market', label: 'Target market.', example: 'Auto component makers', width: 28 },
  { key: 'revenueModel', label: 'How it earns.', example: 'Subscription', width: 18 },
  { key: 'technology', label: 'Core technology.', example: 'Computer vision', width: 22 },
  { key: 'traction', label: 'Traction so far.', example: '12 pilot customers', width: 24 },
  { key: 'awards', label: 'Awards and recognitions.', example: 'SSIP Grant 2025', width: 24 },
  { key: 'press', label: 'Press coverage.', example: 'Divya Bhaskar, Jan 2026', width: 24 },
  { key: 'mentors', label: 'Mentor names, comma separated.', example: 'Dr. A. Shah', width: 22 },
  { key: 'publishState', label: 'DRAFT, REVIEW, PUBLISHED or ARCHIVED. Defaults to PUBLISHED.', example: 'PUBLISHED', width: 16 },
  { key: 'dateOfIncubation', label: 'Date, as YYYY-MM-DD.', example: '2025-08-01', width: 18 },
  { key: 'stageAtIncubation', label: 'Stage when incubated. Same options as stage.', example: 'Ideation', width: 18 },
  { key: 'schemeParticipation', label: 'Schemes participated in.', example: 'SSIP 2.0', width: 20 },
  { key: 'innovationUSP', label: 'What makes it different.', example: '3x faster inspection', width: 28 },
  { key: 'funding_status', label: 'e.g. Bootstrapped, Grant, Seed.', example: 'Grant', width: 16 },
  { key: 'funding_amount', label: 'e.g. ₹15 Lakh.', example: '₹15 Lakh', width: 14 },
  { key: 'funding_investors', label: 'Investor names.', example: 'SSIP', width: 20 },
  { key: 'funding_rounds', label: 'Rounds raised.', example: '1', width: 12 },
  { key: 'funding_grants', label: 'Grants received.', example: 'SSIP Grant', width: 18 },
  { key: 'regulatory_dpiit', label: 'DPIIT number or Yes/No.', example: 'DIPP12345', width: 16 },
  { key: 'regulatory_startupIndia', label: 'Startup India status.', example: 'Yes', width: 18 },
  { key: 'regulatory_iso', label: 'ISO certification.', example: 'ISO 9001', width: 14 },
  { key: 'regulatory_gst', label: 'GST number.', example: '24ABCDE1234F1Z5', width: 20 },
  { key: 'regulatory_patents', label: 'Patents filed or granted.', example: '1 filed', width: 16 },
  { key: 'team', label: 'Members as "Name | Role | LinkedIn URL" (LinkedIn optional), separated by semicolons.', example: 'Riya Patel | Founder | https://linkedin.com/in/riyapatel; Amit Shah | Co-Founder', width: 48 },
];

const EXAMPLE_MARKER = 'EXAMPLE';

// ── Template ─────────────────────────────────────────────────────────────────

const VALID_STATES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

// Mirrors the dropdown in StartupForm. The admin UI cannot produce anything
// else, so a spreadsheet should not be able to either — a stray "Ideaton"
// imports silently and then matches no filter on the public site.
const VALID_STAGES = ['Ideation', 'Validation', 'Early Traction', 'Scaling', 'Revenue'];

/** Case-insensitive match that returns the canonical spelling. */
function canonical(value: string, allowed: string[]) {
  return allowed.find((a) => a.toLowerCase() === value.trim().toLowerCase());
}

/** Columns that become dropdowns, and where their options come from. */
const DROPDOWNS: Record<string, string[] | 'sectors' | 'schemes'> = {
  stage: VALID_STAGES,
  stageAtIncubation: VALID_STAGES,
  publishState: VALID_STATES,
  sector: 'sectors',
  schemeParticipation: 'schemes',
};

const VALIDATED_ROWS = 2000; // dropdowns apply this far down, so paste-in works

export async function buildTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Startups');

  sheet.columns = COLUMNS.map((c) => ({ header: c.key, key: c.key, width: c.width || 20 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9F5' },
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // One filled-in row so the expected format is obvious. The importer skips any
  // row whose name begins with EXAMPLE, so leaving it in place is harmless.
  const example: Record<string, string> = {};
  for (const c of COLUMNS) example[c.key] = c.example ?? '';
  example.name = `${EXAMPLE_MARKER} — delete this row: ${example.name}`;
  sheet.addRow(example);

  if (format === 'csv') {
    const buffer = await wb.csv.writeBuffer();
    return { buffer: Buffer.from(buffer), filename: 'startups-import-template.csv' };
  }

  const guide = wb.addWorksheet('Instructions');
  guide.columns = [
    { header: 'Column', key: 'col', width: 28 },
    { header: 'What to put in it', key: 'desc', width: 80 },
  ];
  guide.getRow(1).font = { bold: true };
  for (const c of COLUMNS) guide.addRow({ col: c.key, desc: c.label });
  guide.addRow({});
  guide.addRow({ col: 'Logos', desc: 'Cannot be imported from a spreadsheet — upload them per startup after importing.' });
  guide.addRow({ col: 'Existing startups', desc: 'Matched by name, case-insensitively. Choose whether to skip or update them when importing.' });

  // ── Dropdowns ──────────────────────────────────────────────────────────────
  // Options live on a separate sheet and are referenced by range. Excel caps an
  // inline list at 255 characters, which the sector list would blow straight
  // past once Master data grows.
  const [sectorRows, subSectorRows, schemeRows] = await Promise.all([
    prisma.sector.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.subSector.findMany({ select: { name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.scheme.findMany({ select: { name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);
  const optionLists: Record<string, string[]> = {
    sectors: Array.from(new Set([...sectorRows, ...subSectorRows].map((x: any) => x.name).filter(Boolean))),
    schemes: schemeRows.map((x: any) => x.name).filter(Boolean),
  };

  const lists = wb.addWorksheet('Lists');
  lists.state = 'veryHidden'; // not just hidden — stops it being unhidden by accident

  let listCol = 1;
  const ranges: Record<string, string> = {};
  for (const [field, source] of Object.entries(DROPDOWNS)) {
    const values = Array.isArray(source) ? source : optionLists[source] || [];
    if (!values.length) continue;
    const letter = lists.getColumn(listCol).letter;
    lists.getCell(`${letter}1`).value = field;
    values.forEach((v, i) => { lists.getCell(`${letter}${i + 2}`).value = v; });
    ranges[field] = `Lists!$${letter}$2:$${letter}$${values.length + 1}`;
    listCol++;
  }

  for (const [field, range] of Object.entries(ranges)) {
    const colIndex = COLUMNS.findIndex((c) => c.key === field) + 1;
    if (colIndex < 1) continue;
    const letter = sheet.getColumn(colIndex).letter;
    for (let r = 2; r <= VALIDATED_ROWS; r++) {
      sheet.getCell(`${letter}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [range],
        // A warning, not a hard stop: Master data changes, and legacy scheme
        // names still need to be enterable.
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Not in the list',
        error: 'This value is not one of the options. Stage and Publish State must match exactly; sector and scheme will import with a warning.',
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: 'startups-import-template.xlsx' };
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function cellText(value: any): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // ExcelJS returns objects for formulas, hyperlinks and rich text.
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value) return value.richText.map((r: any) => r.text).join('').trim();
    if ('hyperlink' in value) return String(value.hyperlink ?? '').trim();
    return '';
  }
  return String(value).trim();
}

function parseTeam(raw: string) {
  if (!raw) return undefined;
  const members = raw
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      // "Name | Role | LinkedIn" — the last two are optional.
      const [name, role, linkedin] = chunk.split('|').map((s) => s.trim());
      const member: { name: string; role: string; linkedin?: string } = {
        name: name || chunk,
        role: role || '',
      };
      if (linkedin) member.linkedin = linkedin;
      return member;
    })
    .filter((m) => m.name);
  return members.length ? members : undefined;
}

function groupPrefixed(row: Record<string, string>, prefix: string) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith(prefix) && v) out[k.slice(prefix.length)] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; name: string; message: string }[];
  /** Rows that imported, but with a value worth a second look. */
  warnings: { row: number; name: string; message: string }[];
  dryRun: boolean;
}

/**
 * @param mode 'skip' leaves existing startups untouched; 'update' overwrites
 *             them from the sheet, matching on name.
 * @param dryRun validate and report without writing anything.
 */
export async function importStartups(
  file: Buffer,
  filename: string,
  options: { mode?: 'skip' | 'update'; dryRun?: boolean } = {},
): Promise<ImportResult> {
  const mode = options.mode === 'update' ? 'update' : 'skip';
  const dryRun = !!options.dryRun;

  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    const { Readable } = await import('stream');
    await wb.csv.read(Readable.from(file));
  } else {
    await wb.xlsx.load(file);
  }

  const sheet = wb.getWorksheet('Startups') || wb.worksheets[0];
  if (!sheet) throw new Error('The file has no worksheets');

  // Header row drives the mapping, so admins may reorder or delete columns.
  const headers: Record<number, string> = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const key = cellText(cell.value);
    if (key) headers[col] = key;
  });
  if (!Object.values(headers).includes('name')) {
    throw new Error('Missing a "name" column — please start from the downloaded template');
  }

  const result: ImportResult = { total: 0, created: 0, updated: 0, skipped: 0, errors: [], dryRun, warnings: [] };
  const seenNames = new Set<string>();

  // Sector and scheme come from Master data, which admins edit — so an unknown
  // value is a warning, not a rejection. The row still imports; the admin is
  // told, because an unmatched sector quietly disappears from site filters.
  const [sectors, subSectors, schemes] = await Promise.all([
    prisma.sector.findMany({ select: { name: true } }).catch(() => []),
    prisma.subSector.findMany({ select: { name: true } }).catch(() => []),
    prisma.scheme.findMany({ select: { name: true } }).catch(() => []),
  ]);
  const knownSectors = new Set(
    [...sectors, ...subSectors].map((x: any) => String(x.name).toLowerCase()),
  );
  const knownSchemes = new Set(schemes.map((x: any) => String(x.name).toLowerCase()));

  for (let r = 2; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    const row: Record<string, string> = {};
    excelRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (key) row[key] = cellText(cell.value);
    });

    if (!Object.values(row).some((v) => v)) continue;        // blank row
    if (row.name?.toUpperCase().startsWith(EXAMPLE_MARKER)) continue;

    result.total++;
    const name = (row.name || '').trim();

    if (!name) {
      result.errors.push({ row: r, name: '', message: 'Name is required' });
      continue;
    }
    const dedupeKey = name.toLowerCase();
    if (seenNames.has(dedupeKey)) {
      result.errors.push({ row: r, name, message: 'Duplicate of an earlier row in this file' });
      continue;
    }
    seenNames.add(dedupeKey);

    const publishState = (row.publishState || 'PUBLISHED').toUpperCase();
    if (!VALID_STATES.includes(publishState)) {
      result.errors.push({
        row: r, name,
        message: `publishState "${row.publishState}" is not one of ${VALID_STATES.join(', ')}`,
      });
      continue;
    }

    let stage = row.stage || null;
    if (stage) {
      const match = canonical(stage, VALID_STAGES);
      if (!match) {
        result.errors.push({ row: r, name, message: `stage "${stage}" is not one of ${VALID_STAGES.join(', ')}` });
        continue;
      }
      stage = match;
    }

    let stageAtIncubation = row.stageAtIncubation || null;
    if (stageAtIncubation) {
      const match = canonical(stageAtIncubation, VALID_STAGES);
      if (!match) {
        result.errors.push({ row: r, name, message: `stageAtIncubation "${stageAtIncubation}" is not one of ${VALID_STAGES.join(', ')}` });
        continue;
      }
      stageAtIncubation = match;
    }

    let dateOfIncubation: Date | null = null;
    if (row.dateOfIncubation) {
      const d = new Date(row.dateOfIncubation);
      if (isNaN(d.getTime())) {
        result.errors.push({ row: r, name, message: `dateOfIncubation "${row.dateOfIncubation}" is not a valid date (use YYYY-MM-DD)` });
        continue;
      }
      dateOfIncubation = d;
    }

    const data: any = {
      name,
      logoEmoji: row.logoEmoji || null,
      sector: row.sector || null,
      stage,
      ecosystem: row.ecosystem || null,
      registered: row.registered || null,
      email: row.email || null,
      phone: row.phone || null,
      website: row.website || null,
      businessModel: row.businessModel || null,
      problem: row.problem || null,
      market: row.market || null,
      revenueModel: row.revenueModel || null,
      technology: row.technology || null,
      traction: row.traction || null,
      awards: row.awards || null,
      press: row.press || null,
      mentors: row.mentors || null,
      publishState,
      dateOfIncubation,
      stageAtIncubation,
      schemeParticipation: row.schemeParticipation || null,
      innovationUSP: row.innovationUSP || null,
      funding: groupPrefixed(row, 'funding_'),
      regulatory: groupPrefixed(row, 'regulatory_'),
      team: parseTeam(row.team),
    };
    for (const k of ['funding', 'regulatory', 'team']) {
      if (data[k] === undefined) delete data[k];
    }

    if (row.sector && knownSectors.size && !knownSectors.has(row.sector.toLowerCase())) {
      result.warnings.push({ row: r, name, message: `sector "${row.sector}" is not in Master data — it will not match the site's sector filters` });
    }
    if (row.schemeParticipation && knownSchemes.size && !knownSchemes.has(row.schemeParticipation.toLowerCase())) {
      result.warnings.push({ row: r, name, message: `scheme "${row.schemeParticipation}" is not in Master data — treated as a legacy scheme name` });
    }

    try {
      // No unique constraint on name, so match case-insensitively by hand.
      const existing = await prisma.webStartup.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });

      if (existing && mode === 'skip') {
        result.skipped++;
        continue;
      }
      if (dryRun) {
        existing ? result.updated++ : result.created++;
        continue;
      }
      if (existing) {
        await prisma.webStartup.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.webStartup.create({ data });
        result.created++;
      }
    } catch (err: any) {
      result.errors.push({ row: r, name, message: err?.message || 'Failed to save' });
    }
  }

  return result;
}

// ── Bulk logo matching ───────────────────────────────────────────────────────

/**
 * Reduces a startup name or a filename to a comparable key: lowercase, letters
 * and digits only. So "Acme Robotics Pvt. Ltd.png", "acme-robotics-pvt-ltd.PNG"
 * and "Acme Robotics Pvt Ltd" all collapse to the same thing.
 */
function matchKey(value: string) {
  return value
    .replace(/\.[a-z0-9]+$/i, '')      // drop the extension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface LogoMatchResult {
  matched: { file: string; startup: string }[];
  unmatched: string[];
  ambiguous: { file: string; startups: string[] }[];
  stillMissing: string[];
  dryRun: boolean;
}

/**
 * Links already-uploaded image files to startups by filename. Name the file
 * after the startup — punctuation and spacing do not matter.
 *
 * @param files  what multer wrote: original name plus the stored web path.
 */
export async function attachLogos(
  files: { originalname: string; webPath: string }[],
  options: { dryRun?: boolean; overwrite?: boolean } = {},
): Promise<LogoMatchResult> {
  const dryRun = !!options.dryRun;
  const overwrite = options.overwrite !== false;

  const startups = await prisma.webStartup.findMany({
    select: { id: true, name: true, logoPath: true },
  });

  // One key can legitimately map to several startups with near-identical names,
  // and guessing between them would silently brand the wrong company.
  const byKey = new Map<string, { id: number; name: string; logoPath: string | null }[]>();
  for (const s of startups) {
    const key = matchKey(s.name);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(s as any);
  }

  const result: LogoMatchResult = {
    matched: [], unmatched: [], ambiguous: [], stillMissing: [], dryRun,
  };
  const usedIds = new Set<number>();

  for (const file of files) {
    const candidates = byKey.get(matchKey(file.originalname));
    if (!candidates?.length) {
      result.unmatched.push(file.originalname);
      continue;
    }
    if (candidates.length > 1) {
      result.ambiguous.push({ file: file.originalname, startups: candidates.map((c) => c.name) });
      continue;
    }
    const target = candidates[0];
    if (target.logoPath && !overwrite) {
      result.unmatched.push(`${file.originalname} (already has a logo)`);
      continue;
    }
    if (!dryRun) {
      await prisma.webStartup.update({
        where: { id: target.id },
        data: { logoPath: file.webPath },
      });
    }
    usedIds.add(target.id);
    result.matched.push({ file: file.originalname, startup: target.name });
  }

  result.stillMissing = startups
    .filter((s) => !s.logoPath && !usedIds.has(s.id))
    .map((s) => s.name)
    .sort();

  return result;
}
