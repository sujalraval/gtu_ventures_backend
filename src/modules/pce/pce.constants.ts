import { Prisma } from '@prisma/client';

/**
 * Shared PCE predicates.
 *
 * These were written out in both pce.service and scheme-assignment.service,
 * which is how a dashboard card and the screen it links to come to disagree:
 * the card counted one set of statuses and the listing filtered by another.
 * Both now read from here, so the number on the card is the number of rows in
 * the list by construction.
 */

/** Only live applications count anywhere in this module. */
export const LIVE = { deletedAt: null } as const;

/** Scheme assignment statuses that mean a scheme has actually been decided. */
export const DECIDED_SCHEME_STATUSES = [
  'SUGGESTED',
  'PROVISIONALLY_ASSIGNED',
  'ASSIGNED',
  'CHANGED',
  'CONFIRMED',
  'FINAL_APPROVED',
] as const;

export const DECIDED = new Set<string>(DECIDED_SCHEME_STATUSES);

export const ONBOARDING_NOT_STARTED = ['NOT_STARTED', 'SELECTED', 'SCHEME_CONFIRMED'] as const;

export const ONBOARDING_IN_PROGRESS = [
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'AGREEMENT_PENDING',
  'FINAL_APPROVAL_PENDING',
] as const;

export const APPROVED_DECISIONS = [
  'APPROVED_FOR_INCUBATION',
  'APPROVED_WITH_GRANT',
  'APPROVED_WITHOUT_GRANT',
  'APPROVED_WITH_CONDITIONS',
] as const;

/**
 * Who takes part in the PCE journey.
 *
 * Section 2 puts scheme assignment after preliminary screening and allows it
 * right up to onboarding, so this is "selected for pitch or later", plus
 * anything this module has already touched - an application whose status moved
 * on afterwards should not vanish from the page that assigned it.
 */
export const PCE_COHORT: Prisma.StartupApplicationWhereInput = {
  ...LIVE,
  OR: [
    { status: { in: ['SELECTED_FOR_PITCH', 'APPROVED'] } },
    { pceState: { isNot: null } },
  ],
};

/**
 * No scheme decided yet: either no state row at all, because they are created
 * lazily, or a row that explicitly says so. Both have to match or the count
 * reads zero on a fresh install while the listing shows rows.
 */
export const NO_SCHEME_ASSIGNED: Prisma.StartupApplicationWhereInput = {
  OR: [{ pceState: { is: null } }, { pceState: { schemeStatus: 'NOT_ASSIGNED' } }],
};
