import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CollateralEvent {
  id: string;
  title: string;
  code: string;
  type: string;
  status: string;
  mode: string;
  startDate: Date;
  endDate: Date;
  venue: string | null;
  virtualLink: string | null;
  description: string | null;
  organiserName: string | null;
  organiserEmail: string | null;
  registrationFields: any;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchEvent(eventId: string): Promise<CollateralEvent> {
  const ev = await prisma.event.findUnique({ where: { id: eventId } });
  if (!ev) throw new NotFoundError('Event not found');
  return ev;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTime(d: Date) {
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── 1. Attendee list CSV ───────────────────────────────────────────────────────

export async function generateAttendeeCSV(eventId: string): Promise<{ csv: string; filename: string }> {
  const ev = await fetchEvent(eventId);

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });

  // One extra column per question this event asked, so the organiser gets the
  // college / enrolment answers in the same sheet rather than having to dig
  // them out of the JSON.
  const extraFields: any[] = Array.isArray(ev.registrationFields) ? ev.registrationFields : [];

  const csvCell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'QR Token', 'Name', 'Email', 'Phone', 'Organisation', 'Designation',
    'Type', 'Startup',
    ...extraFields.map(f => f.label || f.key),
    'Status', 'Checked In', 'Check-In Time', 'Registered At',
  ];

  const rows = registrations.map(r => {
    const answers = (r.customFields || {}) as Record<string, any>;
    return [
      r.qrToken,
      csvCell(r.name),
      r.email,
      r.phone || '',
      csvCell(r.organization),
      csvCell(r.designation),
      r.participantType || 'PARTICIPANT',
      csvCell(r.startupName),
      ...extraFields.map(f => csvCell(answers[f.key])),
      r.status,
      r.checkedInAt ? 'Yes' : 'No',
      r.checkedInAt ? fmtDateTime(r.checkedInAt) : '',
      fmtDateTime(r.createdAt),
    ];
  });

  // Admin-defined labels may contain commas, so quote the header row too.
  const csv = [headers.map(csvCell).join(','), ...rows.map(r => r.join(','))].join('\n');
  const filename = `attendees_${ev.code}_${ev.startDate.toISOString().slice(0, 10)}.csv`;

  return { csv, filename };
}

// ── 2. Pitch deck summary CSV ──────────────────────────────────────────────────

export async function generatePitchSummaryCSV(eventId: string): Promise<{ csv: string; filename: string }> {
  const ev = await fetchEvent(eventId);

  const decks = await prisma.pitchDeckSubmission.findMany({
    where: { eventId, isActive: true },
    include: { startup: { select: { id: true, name: true, email: true } } },
    orderBy: { submittedAt: 'asc' },
  });

  // Get schedule slots for presentation order
  const slots = await prisma.eventScheduleSlot.findMany({
    where: { eventId },
    orderBy: { position: 'asc' },
  });
  const slotMap = new Map(slots.map(s => [s.startupId, s]));

  // Get scores (leaderboard)
  const scores = await prisma.startupScore.findMany({
    where: { eventId },
    include: { criteria: { select: { name: true, weight: true, maxScore: true } } },
  });

  // Aggregate weighted scores per startup
  const scoreMap = new Map<string, number>();
  const startupCriteriaScores = new Map<string, Map<string, number[]>>();

  for (const s of scores) {
    if (!startupCriteriaScores.has(s.startupId)) startupCriteriaScores.set(s.startupId, new Map());
    const criteriaMap = startupCriteriaScores.get(s.startupId)!;
    if (!criteriaMap.has(s.criteriaId)) criteriaMap.set(s.criteriaId, []);
    criteriaMap.get(s.criteriaId)!.push(s.score);
  }

  for (const [startupId, criteriaMap] of startupCriteriaScores) {
    let total = 0;
    for (const [criteriaId, scoreArr] of criteriaMap) {
      const scoreRecord = scores.find(s => s.criteriaId === criteriaId);
      const weight = scoreRecord?.criteria?.weight ?? 1;
      const avg = scoreArr.reduce((a, b) => a + b, 0) / scoreArr.length;
      total += avg * weight;
    }
    scoreMap.set(startupId, Math.round(total * 100) / 100);
  }

  const headers = [
    'Presentation Order', 'Startup Name', 'Email',
    'Pitch Deck File', 'Version', 'Deck Status', 'Reviewer Notes',
    'Scheduled Time', 'Duration (min)', 'Weighted Score', 'Submitted At',
  ];

  const rows = decks.map(d => {
    const slot = slotMap.get(d.startupId);
    return [
      slot ? String(slot.position) : '—',
      `"${(d.startup.name || '').replace(/"/g, '""')}"`,
      d.startup.email,
      `"${d.fileName.replace(/"/g, '""')}"`,
      String(d.version),
      d.status,
      `"${(d.reviewerNotes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      slot?.scheduledTime ? fmtDateTime(slot.scheduledTime) : '—',
      slot ? String(slot.durationMins) : '—',
      scoreMap.has(d.startupId) ? String(scoreMap.get(d.startupId)) : '—',
      fmtDateTime(d.submittedAt),
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const filename = `pitch_summary_${ev.code}_${ev.startDate.toISOString().slice(0, 10)}.csv`;

  return { csv, filename };
}

// ── 3. Full event report PDF ───────────────────────────────────────────────────

export async function generateEventReportPDF(eventId: string): Promise<{ buffer: Buffer; filename: string }> {
  const ev = await fetchEvent(eventId);

  // Fetch all data in parallel
  const [registrations, decks, slots, scores, criteria] = await Promise.all([
    prisma.eventRegistration.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
    prisma.pitchDeckSubmission.findMany({
      where: { eventId, isActive: true },
      include: { startup: { select: { id: true, name: true, email: true } } },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.eventScheduleSlot.findMany({
      where: { eventId },
      include: { startup: { select: { id: true, name: true, email: true } } },
      orderBy: { position: 'asc' },
    }),
    prisma.startupScore.findMany({
      where: { eventId },
      include: { criteria: true, startup: { select: { id: true, name: true } } },
    }),
    prisma.scorecardCriteria.findMany({ where: { eventId }, orderBy: { position: 'asc' } }),
  ]);

  // Build leaderboard
  const startupScoreMap = new Map<string, { name: string; total: number; max: number }>();
  for (const s of decks) {
    if (!startupScoreMap.has(s.startupId)) {
      startupScoreMap.set(s.startupId, { name: s.startup.name || s.startup.email, total: 0, max: 0 });
    }
  }
  for (const c of criteria) {
    const criteriaScores = scores.filter(s => s.criteriaId === c.id);
    const startupGroups = new Map<string, number[]>();
    for (const s of criteriaScores) {
      if (!startupGroups.has(s.startupId)) startupGroups.set(s.startupId, []);
      startupGroups.get(s.startupId)!.push(s.score);
    }
    for (const [startupId, arr] of startupGroups) {
      if (!startupScoreMap.has(startupId)) {
        const scoreRec = scores.find(s => s.startupId === startupId);
        startupScoreMap.set(startupId, { name: (scoreRec as any)?.startup?.name || 'Unknown', total: 0, max: 0 });
      }
      const entry = startupScoreMap.get(startupId)!;
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      entry.total += avg * c.weight;
      entry.max += c.maxScore * c.weight;
    }
  }
  const leaderboard = Array.from(startupScoreMap.entries())
    .map(([id, v]) => ({ id, ...v, pct: v.max > 0 ? Math.round((v.total / v.max) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  // Build PDF
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  doc.pipe(pass);
  pass.on('data', chunk => chunks.push(chunk));

  const BRAND = '#1e3a5f';
  const ACCENT = '#2563eb';
  const TEXT = '#374151';
  const MUTED = '#6b7280';

  function heading(text: string) {
    doc.moveDown(0.5)
      .rect(doc.x, doc.y, doc.page.width - 100, 1.5).fill(ACCENT)
      .moveDown(0.4)
      .fontSize(13).fillColor(BRAND).font('Helvetica-Bold').text(text)
      .moveDown(0.3).fillColor(TEXT).font('Helvetica').fontSize(10);
  }

  function row(label: string, value: string) {
    doc.font('Helvetica-Bold').fillColor(MUTED).text(label + ': ', { continued: true })
      .font('Helvetica').fillColor(TEXT).text(value);
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 180).fill(BRAND);
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
    .text('EVENT REPORT', 50, 50)
    .fontSize(16).font('Helvetica')
    .text(ev.title, 50, 82)
    .fontSize(10).fillColor('#93c5fd')
    .text(`${fmtDate(ev.startDate)} — ${fmtDate(ev.endDate)}`, 50, 112)
    .text(`Code: ${ev.code}  •  Type: ${ev.type}  •  Mode: ${ev.mode}`, 50, 130);

  doc.moveDown(5).fillColor(TEXT).font('Helvetica').fontSize(10);

  // ── Event Details ──────────────────────────────────────────────────────────
  heading('Event Overview');
  row('Status', ev.status);
  if (ev.venue) row('Venue', ev.venue);
  if (ev.virtualLink) row('Virtual Link', ev.virtualLink);
  if (ev.organiserName) row('Organiser', `${ev.organiserName}${ev.organiserEmail ? ` <${ev.organiserEmail}>` : ''}`);
  if (ev.description) {
    doc.moveDown(0.3).font('Helvetica-Bold').fillColor(MUTED).text('Description:')
      .font('Helvetica').fillColor(TEXT).text(ev.description, { indent: 10 });
  }

  // ── Stats Summary ──────────────────────────────────────────────────────────
  heading('Summary Statistics');
  const checkedIn = registrations.filter(r => r.checkedInAt).length;
  const acceptedDecks = decks.filter(d => d.status === 'ACCEPTED').length;

  doc.text(`Total Registrations: ${registrations.length}`)
    .text(`Attendees Checked In: ${checkedIn} (${registrations.length > 0 ? Math.round(checkedIn / registrations.length * 100) : 0}%)`)
    .text(`Pitch Decks Submitted: ${decks.length}  (Accepted: ${acceptedDecks})`)
    .text(`Startups Scheduled: ${slots.length}`)
    .text(`Scoring Criteria: ${criteria.length}`)
    .text(`Total Judges' Scores: ${scores.length}`);

  // ── Presentation Schedule ──────────────────────────────────────────────────
  if (slots.length > 0) {
    heading('Presentation Schedule');
    for (const slot of slots) {
      const timeStr = slot.scheduledTime ? fmtDateTime(slot.scheduledTime) : 'TBD';
      doc.text(`${slot.position}. ${slot.startup.name || slot.startup.email}`)
        .font('Helvetica').fillColor(MUTED)
        .text(`   ${timeStr} · ${slot.durationMins} min + ${slot.bufferMins} min Q&A`, { indent: 10 })
        .fillColor(TEXT);
      if (slot.notes) doc.text(`   Note: ${slot.notes}`, { indent: 10 });
      doc.moveDown(0.2);
    }
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────
  if (leaderboard.length > 0 && criteria.length > 0) {
    heading('Scorecard Results');
    leaderboard.forEach((entry, idx) => {
      const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `${idx + 1}. `;
      doc.font('Helvetica-Bold').fillColor(idx < 3 ? ACCENT : TEXT)
        .text(`${medal}${entry.name}`, { continued: true })
        .font('Helvetica').fillColor(MUTED)
        .text(`   ${entry.total.toFixed(1)} pts  (${entry.pct}%)`);
    });
  }

  // ── Attendee List (abridged, first 50) ────────────────────────────────────
  if (registrations.length > 0) {
    heading(`Attendee List (${registrations.length} total${registrations.length > 50 ? ', showing first 50' : ''})`);
    const shown = registrations.slice(0, 50);
    for (const r of shown) {
      const statusTag = r.checkedInAt ? '✓' : '○';
      doc.text(`${statusTag}  ${r.name || r.email}  <${r.email}>  [${r.status}]`);
    }
    if (registrations.length > 50) {
      doc.fillColor(MUTED).text(`... and ${registrations.length - 50} more. Download the attendee CSV for the full list.`).fillColor(TEXT);
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(MUTED)
      .text(
        `GTU — ${ev.title} — Generated ${fmtDateTime(new Date())} — Page ${i + 1} of ${pages.count}`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );
  }

  doc.end();

  await new Promise<void>(resolve => pass.on('end', resolve));
  const buffer = Buffer.concat(chunks);
  const filename = `event_report_${ev.code}_${ev.startDate.toISOString().slice(0, 10)}.pdf`;

  return { buffer, filename };
}
