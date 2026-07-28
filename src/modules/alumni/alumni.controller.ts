import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DirectoryEntry {
  id: string;
  startupName: string;
  companyName: string;
  founderName: string;
  sector: string;
  stage: string;
  geography: string;
  city: string;
  state: string;
  fundingRaised: number;
  employees: number;
  cohort: string;
  email: string;
  website: string | null;
  description: string;
  graduatedAt: Date | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Activity {
  activity: string;
  date: string;
  outcome?: string;
  loggedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Map from DB raw stage → display label
const STAGE_DISPLAY_MAP: Record<string, string> = {
  IDEA: 'Idea',
  PROTOTYPE: 'MVP',
  MVP: 'MVP',
  REVENUE: 'Early Revenue',
  SCALE: 'Scale',
};

// Map from display label → DB raw values (for filtering)
const STAGE_REVERSE_MAP: Record<string, string[]> = {
  Idea: ['IDEA'],
  MVP: ['PROTOTYPE', 'MVP'],
  'Early Revenue': ['REVENUE'],
  Scale: ['SCALE'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapStage(stage: string | null | undefined): string {
  if (!stage) return 'Other';
  return STAGE_DISPLAY_MAP[stage.toUpperCase()] ?? stage;
}

function mapGeography(city?: string | null, state?: string | null): string {
  const loc = [city, state].filter(Boolean).join(', ');
  return loc || 'Unknown';
}

function parsePagination(query: Request['query']): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit as string) || 20), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// Express query values are string | string[] | ParsedQs | ParsedQs[]. These cast safely.
function qs(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined;
  return undefined;
}

// Express param values may be widened to string | string[] in some TS configs.
function param(req: Request, key: string): string {
  const v = (req.params as Record<string, string | string[]>)[key];
  return Array.isArray(v) ? v[0] : (v ?? '');
}

// Prisma JSONB fields require InputJsonValue — cast through unknown to satisfy the type system.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function activitiesToJson(arr: Activity[]): any {
  return arr;
}

function paginatedResponse<T>(data: T[], total: number, meta: { page: number; limit: number }): {
  data: T[];
  pagination: PaginationMeta;
} {
  return {
    data,
    pagination: {
      page: meta.page,
      limit: meta.limit,
      total,
      totalPages: Math.ceil(total / meta.limit),
    },
  };
}

type StartupDataUser = NonNullable<Awaited<ReturnType<typeof getStartupData>>>;

async function getStartupData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      startupApplication: {
        include: {
          cohort: { select: { name: true } },
          formB: { select: { founders: true } },
        },
      },
      startupProfile: {
        include: {
          StartupFundingHistory: {
            where: { deletedAt: null },
            select: { amountInr: true },
          },
        },
      },
    },
  });
}

function resolveStartupName(user: {
  name: string | null;
  startupApplication?: { startupName?: string | null } | null;
  startupProfile?: { companyName?: string | null } | null;
}): string {
  return (
    user.startupApplication?.startupName?.trim() ||
    user.startupProfile?.companyName?.trim() ||
    user.name?.trim() ||
    'Unknown'
  );
}

function buildDirectoryEntry(user: StartupDataUser): DirectoryEntry {
  const app = user.startupApplication;
  const profile = user.startupProfile;
  const funding =
    profile?.StartupFundingHistory?.reduce((sum, h) => sum + (h.amountInr ?? 0), 0) ?? 0;

  return {
    id: user.id,
    startupName: resolveStartupName(user),
    companyName: resolveStartupName(user),
    founderName: app?.fullName || user.name || 'Unknown',
    sector: app?.mainSector || profile?.industry || 'Other',
    stage: mapStage(app?.stage || profile?.stage),
    geography: mapGeography(app?.city, app?.state),
    city: app?.city || 'Unknown',
    state: app?.state || 'Unknown',
    fundingRaised: funding,
    employees: 0,
    cohort: app?.cohort?.name || 'Unknown Cohort',
    email: user.email,
    website: app?.website ?? null,
    description: app?.briefAbout || 'A startup from the GUSEC Incubation Program.',
    graduatedAt: app?.graduatedAt ?? null,
  };
}

// ── Directory ─────────────────────────────────────────────────────────────────

export const alumniController = {
  getDirectory: async (req: Request, res: Response) => {
    try {
      const search = qs(req.query.search);
      const sector = qs(req.query.sector);
      const stage = qs(req.query.stage);
      const geography = qs(req.query.geography);
      const fundingMin = qs(req.query.fundingMin);
      const fundingMax = qs(req.query.fundingMax);
      const { page, limit, skip } = parsePagination(req.query);

      // Build DB-level filters for startupApplication
      const appWhere: Record<string, unknown> = {
        status: 'APPROVED',
        graduatedAt: { not: null },  // only truly graduated startups appear in alumni directory
      };
      if (sector) appWhere.mainSector = sector;
      if (stage) {
        const rawStages = STAGE_REVERSE_MAP[stage];
        if (rawStages?.length) appWhere.stage = { in: rawStages };
      }
      if (geography) {
        appWhere.OR = [
          { city: { equals: geography, mode: 'insensitive' } },
          { state: { equals: geography, mode: 'insensitive' } },
        ];
      }

      // Build search condition at DB level
      const userWhere: Record<string, unknown> = {
        role: 'STARTUP',
        deletedAt: null,
        startupApplication: appWhere,
      };
      if (search) {
        userWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { startupApplication: { ...appWhere, startupName: { contains: search, mode: 'insensitive' } } },
        ];
        // remove top-level startupApplication to avoid conflict with OR
        delete userWhere.startupApplication;
        (userWhere.OR as Record<string, unknown>[]).forEach(branch => {
          if (!branch.startupApplication) {
            branch.startupApplication = appWhere;
          }
        });
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: userWhere,
          include: {
            startupApplication: {
              include: {
                cohort: { select: { name: true } },
                formB: { select: { founders: true } },
              },
            },
            startupProfile: {
              include: {
                StartupFundingHistory: {
                  where: { deletedAt: null },
                  select: { amountInr: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.user.count({ where: userWhere }),
      ]);

      let mapped = users.map(buildDirectoryEntry);

      // Funding range — stays post-query because fundingRaised is aggregated, not a column
      if (fundingMin) mapped = mapped.filter(m => m.fundingRaised >= Number(fundingMin));
      if (fundingMax) mapped = mapped.filter(m => m.fundingRaised <= Number(fundingMax));

      res.json({ success: true, ...paginatedResponse(mapped, total, { page, limit }) });
    } catch (error) {
      console.error('[alumni] getDirectory error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch directory' });
    }
  },

  getDirectoryStats: async (_req: Request, res: Response) => {
    try {
      const GRADUATED_FILTER = { status: 'APPROVED', graduatedAt: { not: null }, deletedAt: null } as const;

      const [totalStartups, fundingAgg, sectorData] = await Promise.all([
        prisma.user.count({
          where: {
            role: 'STARTUP',
            deletedAt: null,
            startupApplication: GRADUATED_FILTER,
          },
        }),
        prisma.startupFundingHistory.aggregate({
          where: { deletedAt: null },
          _sum: { amountInr: true },
        }),
        prisma.startupApplication.findMany({
          where: GRADUATED_FILTER,
          select: { mainSector: true },
        }),
      ]);

      const sectors = new Set(sectorData.map(s => s.mainSector).filter(Boolean));

      res.json({
        success: true,
        data: {
          total: totalStartups,
          totalFunding: fundingAgg._sum.amountInr ?? 0,
          totalJobs: 0,
          sectors: sectors.size,
        },
      });
    } catch (error) {
      console.error('[alumni] getDirectoryStats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
  },

  getAlumniById: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const user = await getStartupData(id);
      if (!user) return res.status(404).json({ success: false, message: 'Alumni not found' });

      const [stories, kpis] = await Promise.all([
        prisma.alumniSuccessStory.findMany({
          where: { startupId: id, deletedAt: null },
          orderBy: { eventDate: 'desc' },
        }),
        prisma.alumniKpiSnapshot.findMany({
          where: { alumniId: id, deletedAt: null },
          orderBy: { snapshotYear: 'desc' },
        }),
      ]);

      res.json({
        success: true,
        data: { ...buildDirectoryEntry(user), successStories: stories, kpiSnapshots: kpis },
      });
    } catch (error) {
      console.error('[alumni] getAlumniById error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch alumni' });
    }
  },

  // ── Referral Pipeline ──────────────────────────────────────────────────────

  getReferrals: async (req: Request, res: Response) => {
    try {
      const status = qs(req.query.status);
      const cohortId = qs(req.query.cohortId);
      const { page, limit, skip } = parsePagination(req.query);

      const where: { status?: string; targetCohortId?: string; deletedAt: null } = {
        deletedAt: null,
      };
      if (status) where.status = status;
      if (cohortId) where.targetCohortId = cohortId;

      const [referrals, total] = await Promise.all([
        prisma.alumniReferral.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.alumniReferral.count({ where }),
      ]);

      res.json({ success: true, ...paginatedResponse(referrals, total, { page, limit }) });
    } catch (error) {
      console.error('[alumni] getReferrals error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch referrals' });
    }
  },

  submitReferral: async (req: Request, res: Response) => {
    try {
      const {
        referredBy,
        referredName,
        referredEmail,
        referredStartupName,
        sector,
        stage,
        note,
        targetCohortId,
      } = req.body as {
        referredBy: string;
        referredName: string;
        referredEmail: string;
        referredStartupName: string;
        sector: string;
        stage: string;
        note?: string;
        targetCohortId?: string;
      };

      const referral = await prisma.alumniReferral.create({
        data: {
          id: randomUUID(),
          referredBy,
          referredName,
          referredEmail,
          referredStartupName,
          sector,
          stage,
          note,
          targetCohortId,
          updatedAt: new Date(),
        },
      });
      res.status(201).json({ success: true, data: referral });
    } catch (error) {
      console.error('[alumni] submitReferral error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit referral' });
    }
  },

  submitMyReferral: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const { referredName, referredEmail, referredStartupName, sector, stage, note } =
        req.body as {
          referredName: string;
          referredEmail: string;
          referredStartupName: string;
          sector: string;
          stage: string;
          note?: string;
        };

      const referral = await prisma.alumniReferral.create({
        data: {
          id: randomUUID(),
          referredBy: userId,
          referredName,
          referredEmail,
          referredStartupName,
          sector,
          stage,
          note,
          updatedAt: new Date(),
        },
      });
      res.status(201).json({ success: true, data: referral });
    } catch (error) {
      console.error('[alumni] submitMyReferral error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit referral' });
    }
  },

  updateReferralStatus: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const { status, note } = req.body as {
        status: 'PENDING' | 'SHORTLISTED' | 'APPLIED' | 'REJECTED';
        note?: string;
      };

      const referral = await prisma.alumniReferral.update({
        where: { id },
        data: { status, statusNote: note ?? null, updatedAt: new Date() },
      });
      res.json({ success: true, data: referral });
    } catch (error) {
      console.error('[alumni] updateReferralStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update referral status' });
    }
  },

  // ── Success Stories ────────────────────────────────────────────────────────

  getSuccessStories: async (req: Request, res: Response) => {
    try {
      const type = qs(req.query.type);
      const search = qs(req.query.search);
      const startupId = qs(req.query.startupId);
      const { page, limit, skip } = parsePagination(req.query);
      const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role ?? '');

      const where: Record<string, unknown> = { deletedAt: null };

      // Non-admins only see public stories
      if (!isAdmin) where.isPublic = true;

      if (type) where.type = type;
      if (startupId) where.startupId = startupId;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { startupName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [stories, total] = await Promise.all([
        prisma.alumniSuccessStory.findMany({
          where,
          orderBy: { eventDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.alumniSuccessStory.count({ where }),
      ]);

      res.json({ success: true, ...paginatedResponse(stories, total, { page, limit }) });
    } catch (error) {
      console.error('[alumni] getSuccessStories error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stories' });
    }
  },

  getMySuccessStories: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const stories = await prisma.alumniSuccessStory.findMany({
        where: { startupId: userId, deletedAt: null },
        orderBy: { eventDate: 'desc' },
      });
      res.json({ success: true, data: stories });
    } catch (error) {
      console.error('[alumni] getMySuccessStories error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stories' });
    }
  },

  createSuccessStory: async (req: Request, res: Response) => {
    try {
      const {
        startupId,
        title,
        type,
        description,
        externalUrl,
        amount,
        mediaOutlet,
        eventDate,
        isPublic,
      } = req.body as {
        startupId: string;
        title: string;
        type: string;
        description: string;
        externalUrl?: string;
        amount?: number;
        mediaOutlet?: string;
        eventDate: string;
        isPublic?: boolean;
      };

      // Resolve startupName from DB — never trust client-supplied value
      const user = await prisma.user.findUnique({
        where: { id: startupId },
        include: { startupApplication: { select: { startupName: true } }, startupProfile: { select: { companyName: true } } },
      });
      if (!user) return res.status(404).json({ success: false, message: 'Startup not found' });

      const startupName = resolveStartupName(user);

      const story = await prisma.alumniSuccessStory.create({
        data: {
          id: randomUUID(),
          startupId,
          startupName,
          title,
          type,
          description,
          externalUrl: externalUrl ?? null,
          amount: amount ?? null,
          mediaOutlet: mediaOutlet ?? null,
          eventDate: new Date(eventDate),
          isPublic: isPublic ?? true,
          updatedAt: new Date(),
        },
      });
      res.status(201).json({ success: true, data: story });
    } catch (error) {
      console.error('[alumni] createSuccessStory error:', error);
      res.status(500).json({ success: false, message: 'Failed to create story' });
    }
  },

  updateSuccessStory: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const { title, type, description, externalUrl, amount, mediaOutlet, eventDate, isPublic } =
        req.body as {
          title?: string;
          type?: string;
          description?: string;
          externalUrl?: string;
          amount?: number;
          mediaOutlet?: string;
          eventDate?: string;
          isPublic?: boolean;
        };

      const story = await prisma.alumniSuccessStory.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(type !== undefined && { type }),
          ...(description !== undefined && { description }),
          ...(externalUrl !== undefined && { externalUrl }),
          ...(amount !== undefined && { amount }),
          ...(mediaOutlet !== undefined && { mediaOutlet }),
          ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
          ...(isPublic !== undefined && { isPublic }),
          updatedAt: new Date(),
        },
      });
      res.json({ success: true, data: story });
    } catch (error) {
      console.error('[alumni] updateSuccessStory error:', error);
      res.status(500).json({ success: false, message: 'Failed to update story' });
    }
  },

  deleteSuccessStory: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      // Soft delete — preserves historical record
      await prisma.alumniSuccessStory.update({
        where: { id },
        data: { deletedAt: new Date(), updatedAt: new Date() },
      });
      res.json({ success: true, message: 'Story archived' });
    } catch (error) {
      console.error('[alumni] deleteSuccessStory error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete story' });
    }
  },

  // ── Re-engagement ──────────────────────────────────────────────────────────

  getEngagementFlags: async (req: Request, res: Response) => {
    try {
      const status = qs(req.query.status);
      const type = qs(req.query.type);
      const { page, limit, skip } = parsePagination(req.query);

      const where: Record<string, unknown> = { deletedAt: null };
      if (status) where.status = status;
      if (type) where.types = { has: type };

      const [flags, total] = await Promise.all([
        prisma.alumniEngagementFlag.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.alumniEngagementFlag.count({ where }),
      ]);

      res.json({ success: true, ...paginatedResponse(flags, total, { page, limit }) });
    } catch (error) {
      console.error('[alumni] getEngagementFlags error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch engagement flags' });
    }
  },

  flagForEngagement: async (req: Request, res: Response) => {
    try {
      const { alumniId, types, priority, notes } = req.body as {
        alumniId?: string;
        types: string[];
        priority?: 'HIGH' | 'MEDIUM' | 'LOW';
        notes?: string;
      };

      let alumniName = (req.body.alumniName as string | undefined) || 'Unknown';
      let sector: string | null = (req.body.sector as string | undefined) ?? null;

      if (alumniId) {
        const user = await prisma.user.findUnique({
          where: { id: alumniId },
          include: {
            startupApplication: { select: { startupName: true, mainSector: true } },
            startupProfile: { select: { companyName: true } },
          },
        });
        if (user) {
          alumniName = resolveStartupName(user);
          sector = user.startupApplication?.mainSector ?? sector;
        }
      }

      const flag = await prisma.alumniEngagementFlag.create({
        data: {
          id: randomUUID(),
          alumniId: alumniId ?? null,
          alumniName,
          sector,
          types: types ?? [],
          priority: priority ?? 'MEDIUM',
          notes: notes ?? null,
          status: 'PENDING',
          activities: [],
          updatedAt: new Date(),
        },
      });
      res.status(201).json({ success: true, data: flag });
    } catch (error) {
      console.error('[alumni] flagForEngagement error:', error);
      res.status(500).json({ success: false, message: 'Failed to flag engagement' });
    }
  },

  updateEngagementStatus: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const { status } = req.body as {
        status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';
      };

      const flag = await prisma.alumniEngagementFlag.update({
        where: { id },
        data: { status, updatedAt: new Date() },
      });
      res.json({ success: true, data: flag });
    } catch (error) {
      console.error('[alumni] updateEngagementStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update engagement status' });
    }
  },

  logEngagementActivity: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const { activity, date, outcome } = req.body as {
        activity: string;
        date: string;
        outcome?: string;
      };

      const flag = await prisma.alumniEngagementFlag.findUnique({ where: { id } });
      if (!flag) return res.status(404).json({ success: false, message: 'Engagement flag not found' });

      const existing = Array.isArray(flag.activities) ? (flag.activities as unknown as Activity[]) : [];
      const newActivity: Activity = { activity, date, outcome, loggedAt: new Date().toISOString() };

      const updated = await prisma.alumniEngagementFlag.update({
        where: { id },
        data: { activities: activitiesToJson([...existing, newActivity]), updatedAt: new Date() },
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[alumni] logEngagementActivity error:', error);
      res.status(500).json({ success: false, message: 'Failed to log activity' });
    }
  },

  deleteEngagementActivity: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const index = parseInt(param(req, 'activityIndex'), 10);

      const flag = await prisma.alumniEngagementFlag.findUnique({ where: { id } });
      if (!flag) return res.status(404).json({ success: false, message: 'Engagement flag not found' });

      const existing = Array.isArray(flag.activities) ? (flag.activities as unknown as Activity[]) : [];
      if (index < 0 || index >= existing.length) {
        return res.status(400).json({ success: false, message: 'Invalid activity index' });
      }

      const updated = await prisma.alumniEngagementFlag.update({
        where: { id },
        data: {
          activities: activitiesToJson(existing.filter((_, i) => i !== index)),
          updatedAt: new Date(),
        },
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[alumni] deleteEngagementActivity error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete activity' });
    }
  },

  // ── Longitudinal KPI Tracking ─────────────────────────────────────────────

  getAllKpiSnapshots: async (req: Request, res: Response) => {
    try {
      const year = qs(req.query.year);
      const sector = qs(req.query.sector);
      const { page, limit, skip } = parsePagination(req.query);

      const where: { snapshotYear?: number; sector?: string; deletedAt: null } = {
        deletedAt: null,
      };
      if (year) where.snapshotYear = parseInt(year, 10);
      if (sector) where.sector = sector;

      const [snapshots, total] = await Promise.all([
        prisma.alumniKpiSnapshot.findMany({
          where,
          orderBy: [{ snapshotYear: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.alumniKpiSnapshot.count({ where }),
      ]);

      res.json({ success: true, ...paginatedResponse(snapshots, total, { page, limit }) });
    } catch (error) {
      console.error('[alumni] getAllKpiSnapshots error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch KPI snapshots' });
    }
  },

  getKpiSnapshotsByAlumni: async (req: Request, res: Response) => {
    try {
      const alumniId = param(req, 'alumniId');
      const resolvedId = alumniId === 'me' ? req.user?.id : alumniId;
      if (!resolvedId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const snapshots = await prisma.alumniKpiSnapshot.findMany({
        where: { alumniId: resolvedId, deletedAt: null },
        orderBy: { snapshotYear: 'desc' },
      });
      res.json({ success: true, data: snapshots });
    } catch (error) {
      console.error('[alumni] getKpiSnapshotsByAlumni error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch alumni KPIs' });
    }
  },

  submitKpiSnapshot: async (req: Request, res: Response) => {
    try {
      const {
        alumniId,
        snapshotYear,
        snapshotType,
        revenue,
        employees,
        fundingRaised,
        customers,
        patentsFiled,
        stage,
        isActive,
        cohort,
      } = req.body as {
        alumniId: string;
        snapshotYear: number;
        snapshotType: '1_YEAR' | '3_YEAR' | '5_YEAR' | 'ANNUAL';
        revenue?: number;
        employees?: number;
        fundingRaised?: number;
        customers?: number;
        patentsFiled?: number;
        stage?: string;
        isActive?: boolean;
        cohort?: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: alumniId },
        include: {
          startupApplication: { select: { startupName: true, mainSector: true } },
          startupProfile: { select: { companyName: true } },
        },
      });
      if (!user) return res.status(404).json({ success: false, message: 'Alumni not found' });

      const alumniName = resolveStartupName(user);
      const sector = user.startupApplication?.mainSector ?? null;

      const snap = await prisma.alumniKpiSnapshot.create({
        data: {
          id: randomUUID(),
          alumniId,
          alumniName,
          sector,
          cohort: cohort ?? null,
          snapshotYear,
          snapshotType,
          revenue: revenue ?? 0,
          employees: employees ?? 0,
          fundingRaised: fundingRaised ?? 0,
          customers: customers ?? 0,
          patentsFiled: patentsFiled ?? 0,
          stage: stage ?? null,
          isActive: isActive ?? true,
          updatedAt: new Date(),
        },
      });
      res.status(201).json({ success: true, data: snap });
    } catch (error) {
      console.error('[alumni] submitKpiSnapshot error:', error);
      res.status(500).json({ success: false, message: 'Failed to create KPI snapshot' });
    }
  },

  submitMyKpiSnapshot: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const {
        snapshotYear,
        snapshotType,
        revenue,
        employees,
        fundingRaised,
        customers,
        patentsFiled,
        stage,
        isActive,
      } = req.body as {
        snapshotYear: number;
        snapshotType: '1_YEAR' | '3_YEAR' | '5_YEAR' | 'ANNUAL';
        revenue?: number;
        employees?: number;
        fundingRaised?: number;
        customers?: number;
        patentsFiled?: number;
        stage?: string;
        isActive?: boolean;
      };

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          startupApplication: { select: { startupName: true, mainSector: true } },
          startupProfile: { select: { companyName: true } },
        },
      });

      const snap = await prisma.alumniKpiSnapshot.create({
        data: {
          id: randomUUID(),
          alumniId: userId,
          alumniName: user ? resolveStartupName(user) : 'Unknown',
          sector: user?.startupApplication?.mainSector ?? null,
          snapshotYear,
          snapshotType,
          revenue: revenue ?? 0,
          employees: employees ?? 0,
          fundingRaised: fundingRaised ?? 0,
          customers: customers ?? 0,
          patentsFiled: patentsFiled ?? 0,
          stage: stage ?? null,
          isActive: isActive ?? true,
          updatedAt: new Date(),
        },
      });
      res.status(201).json({ success: true, data: snap });
    } catch (error) {
      console.error('[alumni] submitMyKpiSnapshot error:', error);
      res.status(500).json({ success: false, message: 'Failed to create KPI snapshot' });
    }
  },

  updateKpiSnapshot: async (req: Request, res: Response) => {
    try {
      const id = param(req, 'id');
      const { revenue, employees, fundingRaised, customers, patentsFiled, stage, isActive } =
        req.body as {
          revenue?: number;
          employees?: number;
          fundingRaised?: number;
          customers?: number;
          patentsFiled?: number;
          stage?: string;
          isActive?: boolean;
        };

      const snap = await prisma.alumniKpiSnapshot.update({
        where: { id },
        data: {
          ...(revenue !== undefined && { revenue }),
          ...(employees !== undefined && { employees }),
          ...(fundingRaised !== undefined && { fundingRaised }),
          ...(customers !== undefined && { customers }),
          ...(patentsFiled !== undefined && { patentsFiled }),
          ...(stage !== undefined && { stage }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        },
      });
      res.json({ success: true, data: snap });
    } catch (error) {
      console.error('[alumni] updateKpiSnapshot error:', error);
      res.status(500).json({ success: false, message: 'Failed to update KPI snapshot' });
    }
  },

  requestKpiSubmission: async (req: Request, res: Response) => {
    try {
      const { alumniIds, snapshotYear } = req.body as {
        alumniIds: string[];
        snapshotYear: number;
      };

      if (!Array.isArray(alumniIds) || alumniIds.length === 0) {
        return res.status(400).json({ success: false, message: 'alumniIds must be a non-empty array' });
      }

      const users = await prisma.user.findMany({
        where: { id: { in: alumniIds } },
        select: { email: true, name: true, id: true },
      });

      let emailsSent = 0;
      let emailsFailed = 0;
      const failedIds: string[] = [];

      try {
        const { sendEmail } = await import('../../common/utils/mailer');
        const results = await Promise.allSettled(
          users.map(u =>
            sendEmail(
              u.email,
              `KPI Update Request — ${snapshotYear}`,
              `<p>Dear ${u.name},</p><p>Please submit your annual KPI snapshot for <strong>${snapshotYear}</strong> on the GUSEC Alumni Portal.</p>`
            ).then(() => ({ id: u.id, ok: true }))
          )
        );
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.ok) {
            emailsSent++;
          } else {
            emailsFailed++;
            failedIds.push(users[i].id);
            console.error(`[alumni] KPI email failed for user ${users[i].id}:`, r.status === 'rejected' ? r.reason : 'unknown');
          }
        });
      } catch (mailerErr) {
        console.error('[alumni] Mailer unavailable:', mailerErr);
        emailsFailed = users.length;
      }

      res.json({
        success: true,
        message: `${emailsSent} reminder(s) sent${emailsFailed > 0 ? `, ${emailsFailed} failed` : ''}.`,
        data: { emailsSent, emailsFailed, failedIds },
      });
    } catch (error) {
      console.error('[alumni] requestKpiSubmission error:', error);
      res.status(500).json({ success: false, message: 'Failed to queue reminders' });
    }
  },

  // ── Startup-facing (my profile) ───────────────────────────────────────────

  getMyAlumniProfile: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const user = await getStartupData(userId);
      if (!user) return res.status(404).json({ success: false, message: 'Profile not found' });

      const [stories, kpis, referrals] = await Promise.all([
        prisma.alumniSuccessStory.findMany({
          where: { startupId: userId, deletedAt: null },
          orderBy: { eventDate: 'desc' },
        }),
        prisma.alumniKpiSnapshot.findMany({
          where: { alumniId: userId, deletedAt: null },
          orderBy: { snapshotYear: 'desc' },
        }),
        prisma.alumniReferral.findMany({
          where: { referredBy: userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      res.json({
        success: true,
        data: {
          ...buildDirectoryEntry(user),
          successStories: stories,
          kpiSnapshots: kpis,
          referrals,
        },
      });
    } catch (error) {
      console.error('[alumni] getMyAlumniProfile error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
  },
};
