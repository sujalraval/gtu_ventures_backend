import { BadRequestError } from '../../common/utils/apiError';
/**
 * The expert categories a scheme's committee mandate can require.
 *
 * Deliberately not a Prisma enum. Two reasons: a scheme may name a category
 * this list does not anticipate, and adding enum values to a live Postgres
 * database is an ALTER TYPE that a migration cannot always run inside a
 * transaction. Stored as strings on Evaluator.expertCategories and on
 * MandateCategoryRequirement.category, validated against this list.
 *
 * `mandatoryCapable` marks the categories the spec lists as ones a scheme may
 * *require*. The rest are the additional categories a committee may include.
 * Nothing stops a scheme requiring an additional category - the flag only
 * drives which are offered first.
 */

export interface ExpertCategory {
  key: string;
  label: string;
  /** Listed by the spec under mandatory members rather than optional. */
  mandatoryCapable: boolean;
}

export const EXPERT_CATEGORIES: ExpertCategory[] = [
  // Mandatory members, per the spec.
  { key: 'GOVERNMENT_REPRESENTATIVE', label: 'Government representative', mandatoryCapable: true },
  { key: 'ACADEMIC_TEACHING', label: 'Academic / teaching expert', mandatoryCapable: true },
  { key: 'INDUSTRY', label: 'Industry expert', mandatoryCapable: true },
  { key: 'STARTUP_ENTREPRENEUR', label: 'Startup / entrepreneur expert', mandatoryCapable: true },
  { key: 'SUBJECT_MATTER_TECHNICAL', label: 'Subject-matter / technical expert', mandatoryCapable: true },
  { key: 'INVESTOR_VC_FINANCIAL', label: 'Investor / VC / financial expert', mandatoryCapable: true },
  { key: 'INCUBATOR_ACCELERATOR', label: 'Incubator / accelerator representative', mandatoryCapable: true },
  { key: 'LEGAL_IP', label: 'Legal / IP expert', mandatoryCapable: true },

  { key: 'DOMAIN_EXPERT', label: 'Domain expert', mandatoryCapable: true },

  // Optional / additional members.
  { key: 'MENTOR', label: 'Mentor', mandatoryCapable: false },
  { key: 'CORPORATE_REPRESENTATIVE', label: 'Corporate representative', mandatoryCapable: false },
  { key: 'RESEARCH_TECHNOLOGY', label: 'Research / technology expert', mandatoryCapable: false },
  { key: 'FINANCE_ACCOUNTING', label: 'Finance / accounting expert', mandatoryCapable: false },
  { key: 'MARKET_BUSINESS', label: 'Market / business expert', mandatoryCapable: false },
  { key: 'SOCIAL_IMPACT', label: 'Social-impact expert', mandatoryCapable: false },
  { key: 'OTHER_NOMINATED', label: 'Other nominated expert', mandatoryCapable: false },
];

const BY_KEY = new Map(EXPERT_CATEGORIES.map((c) => [c.key, c]));

export const EXPERT_CATEGORY_KEYS = EXPERT_CATEGORIES.map((c) => c.key);

export const isExpertCategory = (key: unknown): boolean => BY_KEY.has(String(key ?? ''));

export const expertCategoryLabel = (key: unknown): string =>
  BY_KEY.get(String(key ?? ''))?.label ??
  String(key ?? '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Drop anything not in the vocabulary, and de-duplicate. */
export const sanitiseCategories = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((v) => String(v ?? '').trim().toUpperCase())
        .filter((v) => BY_KEY.has(v)),
    ),
  );
};

/** A committee or panel membership must name one or two categories. */
export const MEMBER_CATEGORY_MIN = 1;
export const MEMBER_CATEGORY_MAX = 2;

/**
 * The categories a person counts towards on one committee or panel.
 *
 * One at minimum, because a member who counts towards nothing cannot be checked
 * against a mandate at all. Two at maximum, because the point of recording it
 * per membership is to say which hat is being worn here - someone who claims
 * every category they hold satisfies a mandate on paper while sitting in one
 * seat, which is the loophole this closes.
 */
export function sanitiseMemberCategories(input: unknown, label = 'Expert category'): string[] {
  const cleaned = sanitiseCategories(input);
  if (cleaned.length < MEMBER_CATEGORY_MIN) {
    throw new BadRequestError(`${label}: select at least ${MEMBER_CATEGORY_MIN} category.`);
  }
  if (cleaned.length > MEMBER_CATEGORY_MAX) {
    throw new BadRequestError(
      `${label}: select at most ${MEMBER_CATEGORY_MAX} categories, not ${cleaned.length}. ` +
        `Record the one or two this person serves as on this committee; their full ` +
        `expertise stays on the evaluator record.`,
    );
  }
  return cleaned;
}
