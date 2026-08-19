import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PassThrough } from 'stream';
import prisma from '../../lib/prisma';
import { config } from '../../common/config/env';
import { resolveUploadPath } from '../../common/config/paths';
import { sendEmail } from '../../common/utils/mailer';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

/** Where a scanned certificate QR sends the reader. */
export function verificationUrl(certificateNo: string) {
  const base = (config.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  return `${base}/verify/${encodeURIComponent(certificateNo)}`;
}

// ── Template ─────────────────────────────────────────────────────────────────

export interface CertificateTemplate {
  enabled: boolean;
  title: string;
  programmeLine: string;
  bodyText: string;
  accentColor: string;
  logos: string[];
  signatories: { name: string; designation: string; signature?: string }[];
}

export const DEFAULT_TEMPLATE: CertificateTemplate = {
  enabled: false,
  title: 'Certificate of Participation',
  programmeLine: '',
  bodyText:
    'This is to certify that {{name}} has participated in {{event}}, held on {{date}} at {{venue}}.',
  accentColor: '#4A2870',
  logos: [],
  signatories: [],
};

export function resolveTemplate(raw: any): CertificateTemplate {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Partial<CertificateTemplate>;
  return {
    ...DEFAULT_TEMPLATE,
    ...t,
    logos: Array.isArray(t.logos) ? t.logos.filter(Boolean) : [],
    signatories: Array.isArray(t.signatories) ? t.signatories.filter((s) => s && s.name) : [],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Uploaded media is served from /uploads, which sits at the project root in both
 * src and dist builds. Returns null when the file is missing so a deleted logo
 * degrades to a gap rather than crashing every certificate in the batch.
 */
function resolveUpload(webPath?: string): string | null {
  const abs = resolveUploadPath(webPath);
  return abs && fs.existsSync(abs) ? abs : null;
}

function fillPlaceholders(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => vars[key] ?? '');
}

// ── Certificate number ───────────────────────────────────────────────────────

/**
 * Sequential per event: GTUV-<CODE>-0001. Hyphens rather than slashes so the
 * number drops straight into a verification URL and a filename without
 * encoding. Derived from the highest number already issued rather than a count,
 * so deleting a registration cannot mint a number that is already in someone's
 * inbox.
 */
async function nextCertificateNumber(eventCode: string) {
  const prefix = `GTUV-${eventCode}-`;
  const last = await prisma.eventRegistration.findFirst({
    where: { certificateNo: { startsWith: prefix } },
    orderBy: { certificateNo: 'desc' },
    select: { certificateNo: true },
  });
  // parseInt stops at the '-' before the check block, so the sequence still
  // reads cleanly out of a full number.
  const lastSeq = last?.certificateNo ? parseInt(last.certificateNo.slice(prefix.length), 10) : 0;
  const seq = String((Number.isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0');

  // Random check block. Without it the numbers are sequential and guessable,
  // and the public verification endpoint would let anyone walk 0001, 0002 …
  // and harvest the full attendee name list for an event.
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — misread when typed off paper
  const check = Array.from(randomBytes(4))
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('');

  return `${prefix}${seq}-${check}`;
}

// ── PDF ──────────────────────────────────────────────────────────────────────

export async function renderCertificatePDF(opts: {
  template: CertificateTemplate;
  name: string;
  eventTitle: string;
  eventDate: Date;
  venue: string | null;
  organisation?: string | null;
  certificateNo: string;
}): Promise<Buffer> {
  const { template: t } = opts;

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);
  });
  doc.pipe(pass);

  const W = doc.page.width;
  const H = doc.page.height;
  const accent = /^#[0-9a-f]{6}$/i.test(t.accentColor) ? t.accentColor : DEFAULT_TEMPLATE.accentColor;
  const INK = '#1a1a2e';
  const MUTED = '#6b7280';

  // Border
  doc.rect(0, 0, W, H).fill('#ffffff');
  doc.lineWidth(6).strokeColor(accent).rect(24, 24, W - 48, H - 48).stroke();
  doc.lineWidth(1).strokeColor(accent).rect(36, 36, W - 72, H - 72).stroke();

  // Logos across the top
  const logoPaths = t.logos.map(resolveUpload).filter(Boolean) as string[];
  let cursorY = 60;
  if (logoPaths.length) {
    const boxW = 110;
    const gap = 24;
    const totalW = logoPaths.length * boxW + (logoPaths.length - 1) * gap;
    let x = (W - totalW) / 2;
    for (const logo of logoPaths) {
      try {
        doc.image(logo, x, cursorY, { fit: [boxW, 56], align: 'center', valign: 'center' });
      } catch {
        // Unreadable image — leave the space blank rather than abort the batch.
      }
      x += boxW + gap;
    }
    cursorY += 76;
  }

  // Title
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(30)
    .text(t.title || DEFAULT_TEMPLATE.title, 60, cursorY, { width: W - 120, align: 'center' });
  cursorY = doc.y + 6;

  if (t.programmeLine) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(12)
      .text(t.programmeLine, 60, cursorY, { width: W - 120, align: 'center' });
    cursorY = doc.y + 4;
  }

  doc.moveTo(W / 2 - 60, cursorY + 8).lineTo(W / 2 + 60, cursorY + 8)
    .lineWidth(2).strokeColor(accent).stroke();
  cursorY += 30;

  // Body
  const body = fillPlaceholders(t.bodyText || DEFAULT_TEMPLATE.bodyText, {
    name: opts.name,
    event: opts.eventTitle,
    date: fmtDate(opts.eventDate),
    venue: opts.venue || '',
    organisation: opts.organisation || '',
    certificateNo: opts.certificateNo,
  });

  doc.fillColor(INK).font('Helvetica').fontSize(14)
    .text(body, 100, cursorY, { width: W - 200, align: 'center', lineGap: 6 });

  // Signatories along the bottom. Inset well clear of the left margin so the
  // verification QR below never collides with the first signature block.
  const sigY = H - 150;
  if (t.signatories.length) {
    const colW = (W - 320) / t.signatories.length;
    t.signatories.forEach((s, i) => {
      const x = 160 + i * colW;
      const sig = resolveUpload(s.signature);
      if (sig) {
        try {
          doc.image(sig, x + colW / 2 - 45, sigY - 42, { fit: [90, 38], align: 'center' });
        } catch {
          // ignore unreadable signature image
        }
      }
      doc.moveTo(x + 20, sigY).lineTo(x + colW - 20, sigY).lineWidth(1).strokeColor('#cbd5e1').stroke();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11)
        .text(s.name, x, sigY + 8, { width: colW, align: 'center' });
      if (s.designation) {
        doc.fillColor(MUTED).font('Helvetica').fontSize(9)
          .text(s.designation, x, doc.y + 1, { width: colW, align: 'center' });
      }
    });
  }

  // Verification QR, bottom-left. Scanning it opens the public verification
  // page, so a recruiter can confirm the certificate without contacting anyone.
  const verifyUrl = verificationUrl(opts.certificateNo);
  try {
    const qr = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 240 });
    doc.image(qr, 62, H - 132, { fit: [62, 62] });
    doc.fillColor(MUTED).font('Helvetica').fontSize(6.5)
      .text('Scan to verify', 52, H - 66, { width: 82, align: 'center' });
  } catch {
    // A QR failure must not cost someone their certificate — the number and
    // the printed URL below are still enough to verify by hand.
  }

  // Certificate number — the anchor for verification
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text(`Certificate No: ${opts.certificateNo}`, 150, H - 66, { width: W - 300, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(7)
    .text(`Verify at ${verifyUrl}`, 150, doc.y + 2, { width: W - 300, align: 'center' });

  doc.end();
  return done;
}

// ── Issuing ──────────────────────────────────────────────────────────────────

async function loadEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError('Event not found');
  return event;
}

/** Builds the PDF for one registration, assigning a number if it has none. */
export async function buildCertificate(eventId: string, registrationId: string) {
  const event = await loadEvent(eventId);
  const template = resolveTemplate(event.certificateTemplate);

  const reg = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, eventId },
  });
  if (!reg) throw new NotFoundError('Registration not found');

  // Attendance is the qualification — this is a participation certificate, and
  // issuing to no-shows would make it meaningless.
  if (!reg.checkedInAt) {
    throw new BadRequestError(`${reg.name} was not checked in at this event`);
  }

  let certificateNo = reg.certificateNo;
  if (!certificateNo) {
    certificateNo = await nextCertificateNumber(event.code);
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { certificateNo, certificateIssuedAt: new Date() },
    });
  }

  const buffer = await renderCertificatePDF({
    template,
    name: reg.name,
    eventTitle: event.title,
    eventDate: event.startDate,
    venue: event.venue,
    organisation: reg.organization,
    certificateNo,
  });

  const safe = certificateNo.replace(/[^a-z0-9]+/gi, '_');
  return { buffer, filename: `certificate_${safe}.pdf`, registration: reg, event, certificateNo };
}

/** Sample PDF for the template editor — never touches a real registration. */
export async function previewCertificate(eventId: string, template?: any) {
  const event = await loadEvent(eventId);
  const buffer = await renderCertificatePDF({
    template: resolveTemplate(template ?? event.certificateTemplate),
    name: 'Participant Name',
    eventTitle: event.title,
    eventDate: event.startDate,
    venue: event.venue,
    organisation: 'Sample Institute',
    certificateNo: `GTUV-${event.code}-0000-SAMP`,
  });
  return { buffer, filename: `certificate_preview_${event.code}.pdf` };
}

export async function emailCertificate(eventId: string, registrationId: string) {
  const { buffer, filename, registration, event, certificateNo } =
    await buildCertificate(eventId, registrationId);

  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 560px;">
      <h2 style="color: #2D3748;">Thank you for attending</h2>
      <p>Dear ${registration.name},</p>
      <p>Thank you for participating in <b>${event.title}</b>. Your certificate of participation is attached to this email.</p>
      <p style="font-size: 13px; color: #718096;">
        Certificate No: ${certificateNo}<br />
        Verify online: <a href="${verificationUrl(certificateNo)}">${verificationUrl(certificateNo)}</a>
      </p>
      <p style="margin-top: 20px; font-size: 12px; color: #718096;">GTU Ventures, Gujarat Technological University</p>
    </div>
  `;

  await sendEmail(registration.email, `Your certificate — ${event.title}`, html);

  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { certificateEmailedAt: new Date() },
  });

  return { email: registration.email, certificateNo };
}

/**
 * Emails every checked-in attendee who has not had one yet. Sent one at a time
 * with a pause: a burst of a few hundred attachments trips SMTP rate limits and
 * damages sending reputation. One failure is recorded and the run continues.
 */
export async function issueForEvent(eventId: string, options: { resend?: boolean } = {}) {
  const event = await loadEvent(eventId);
  const template = resolveTemplate(event.certificateTemplate);
  if (!template.enabled) {
    throw new BadRequestError('Certificates are not enabled for this event. Turn them on in the certificate template first.');
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      checkedInAt: { not: null },
      status: { not: 'CANCELLED' },
      ...(options.resend ? {} : { certificateEmailedAt: null }),
    },
    orderBy: { checkedInAt: 'asc' },
    select: { id: true, name: true, email: true },
  });

  const sent: string[] = [];
  const failed: { email: string; reason: string }[] = [];

  for (const reg of registrations) {
    try {
      await emailCertificate(eventId, reg.id);
      sent.push(reg.email);
    } catch (err: any) {
      failed.push({ email: reg.email, reason: err?.message || 'Unknown error' });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return { total: registrations.length, sent: sent.length, failed };
}

export async function getCertificateStats(eventId: string) {
  await loadEvent(eventId);
  const [checkedIn, issued, emailed] = await Promise.all([
    prisma.eventRegistration.count({
      where: { eventId, checkedInAt: { not: null }, status: { not: 'CANCELLED' } },
    }),
    prisma.eventRegistration.count({ where: { eventId, certificateIssuedAt: { not: null } } }),
    prisma.eventRegistration.count({ where: { eventId, certificateEmailedAt: { not: null } } }),
  ]);
  return { checkedIn, issued, emailed, pending: Math.max(0, checkedIn - emailed) };
}

/** Public lookup so a third party can confirm a certificate is genuine. */
export async function verifyCertificate(certificateNo: string) {
  const reg = await prisma.eventRegistration.findUnique({
    where: { certificateNo },
    select: {
      name: true,
      certificateNo: true,
      certificateIssuedAt: true,
      event: { select: { title: true, startDate: true, venue: true } },
    },
  });
  if (!reg) throw new NotFoundError('No certificate found with that number');
  return reg;
}
