/**
 * The pitching and evaluation lifecycle, as one ordered list of stages.
 *
 * The governing rule from the specification is "one application = one current
 * workflow stage". The obvious way to build the dashboard would be eleven
 * count() queries, one per stage. That is the wrong shape: each predicate
 * would have to negate every later stage, so eleven predicates must agree with
 * each other forever. The first one to drift double-counts an application,
 * which is precisely what the requirement forbids.
 *
 * So the stage is derived once per application, in `deriveStage`, by asking
 * which milestone it has most recently passed. A row lands in exactly one
 * bucket because one switch assigns it. Every KPI, the funnel, the sector and
 * scheme tables and the pending-action lists are then tallies over that single
 * array, and the no-duplication invariant is structural rather than something
 * to be maintained by hand.
 *
 * Historical "how many have ever reached stage X" figures are a separate thing
 * and are computed as a cumulative sum over this same order, which the
 * specification explicitly allows alongside the exclusive current-stage view.
 */

export const STAGES = [
  'PENDING_PLANNING',
  'PLANNED',
  'SCHEDULED',
  'PITCHING_IN_PROGRESS',
  'PITCHING_COMPLETED',
  'EVALUATION_PENDING',
  'EVALUATION_IN_PROGRESS',
  'EVALUATION_COMPLETED',
  'RECOMMENDATION_PENDING',
  'FINAL_DECISION',
  /**
   * Off the main line. Kept as a stage of its own so a cancelled pitch does not
   * sit in Pending Planning forever, inflating the single most action-oriented
   * number on the page.
   */
  'CANCELLED',
] as const;

export type Stage = (typeof STAGES)[number];

/** The stages that form the funnel, in order. CANCELLED is not one of them. */
export const FUNNEL_STAGES = STAGES.filter((s) => s !== 'CANCELLED') as readonly Stage[];

export const STAGE_LABELS: Record<Stage, string> = {
  PENDING_PLANNING: 'Pending Pitching Planning',
  PLANNED: 'Pitching Planned',
  SCHEDULED: 'Pitching Scheduled',
  PITCHING_IN_PROGRESS: 'Pitching In Progress',
  PITCHING_COMPLETED: 'Pitching Completed',
  EVALUATION_PENDING: 'Evaluation Pending',
  EVALUATION_IN_PROGRESS: 'Evaluation In Progress',
  EVALUATION_COMPLETED: 'Evaluation Completed',
  RECOMMENDATION_PENDING: 'Final Recommendation Pending',
  FINAL_DECISION: 'Final Recommendation Completed',
  CANCELLED: 'Pitching Cancelled',
};

/**
 * What each stage means, surfaced to the UI so the definition lives in one
 * place rather than being re-explained in a tooltip that drifts from the code.
 */
export const STAGE_HELP: Record<Stage, string> = {
  PENDING_PLANNING: 'Selected for pitching, with no pitch planned yet.',
  PLANNED: 'A pitch slot exists but the startup has not been told about it.',
  SCHEDULED: 'The startup has been notified and the pitch is still ahead.',
  PITCHING_IN_PROGRESS: 'The pitch window is open right now.',
  PITCHING_COMPLETED: 'The pitch is done but no panel has been allocated to evaluate it.',
  EVALUATION_PENDING: 'Allocated to a panel, with no evaluation submitted yet.',
  EVALUATION_IN_PROGRESS: 'Some seated evaluators have submitted, but not all.',
  EVALUATION_COMPLETED: 'Every seated evaluator has submitted; the committee has not opened a decision.',
  RECOMMENDATION_PENDING: 'A final-selection record is open and awaiting the committee decision.',
  FINAL_DECISION: 'A final decision has been recorded.',
  CANCELLED: 'The pitch was cancelled.',
};

export const STAGE_ORDER: Record<Stage, number> = STAGES.reduce(
  (acc, s, i) => ({ ...acc, [s]: i }),
  {} as Record<Stage, number>,
);

/**
 * How long after a completed pitch an unfinished evaluation counts as overdue.
 *
 * The schema carries no evaluation deadline, so "overdue" has to be derived
 * from something. This is a service-level convention, not data, and it is
 * returned in the payload so the screen can state the rule it is applying
 * instead of showing an unexplained red number.
 */
export const EVALUATION_SLA_DAYS = 7;

/** Pitch statuses that mean a slot exists and is still expected to happen. */
export const LIVE_PITCH_STATUSES = ['SCHEDULED', 'RESCHEDULED'] as const;

/** Evaluator types that the specification counts as "experts" rather than staff. */
export const EXPERT_TYPES = [
  'EXTERNAL_EXPERT',
  'INDUSTRY_EXPERT',
  'TECHNICAL_EXPERT',
  'FINANCIAL_EXPERT',
  'ACADEMIC_EXPERT',
  'SUBJECT_EXPERT',
] as const;

export const EXPERT_TYPE_SET = new Set<string>(EXPERT_TYPES);
