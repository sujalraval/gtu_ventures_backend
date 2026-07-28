import prisma from "../../lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "../../common/utils/mailer";
import { AuthService } from "../auth/auth.service";

export class VcService {
  // ── Registration ───────────────────────────────────────────────────────────

  async applyAsVc(_userId: string | null, data: any) {
    const email = data.signatoryEmail?.toLowerCase().trim();
    if (!email) throw new Error("Signatory email is required");

    // Check if a user with this email already has a VcFirm
    const existing = await prisma.user.findUnique({ where: { email }, include: { vcFirm: true } });
    if (existing?.vcFirm) throw new Error("A VC application already exists for this email");

    let user: { id: string } | null = existing;
    if (!user) {
      // Create a new user account for the VC
      const tempPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
      user = await prisma.user.create({
        data: {
          email,
          name: data.signatoryName,
          password: tempPassword,
          role: "VC" as any,
          isSetupComplete: false,
          isActive: true,
        },
      });
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { role: "VC" as any } });
    }

    const firm = await prisma.vcFirm.create({
      data: {
        userId: user!.id,
        fundName: data.fundName,
        website: data.website || null,
        sebiRegNo: data.sebiRegNo || null,
        headquarters: data.headquarters || null,
        signatoryName: data.signatoryName,
        signatoryEmail: email,
        signatoryMobile: data.signatoryMobile || null,
        description: data.description || null,
        status: "PENDING",
      },
    });

    // Send confirmation email (fire-and-forget)
    sendEmail(
      email,
      "VC Onboarding Application Received – GU Venture Portal",
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#4f46e5">Application Received</h2>
        <p>Dear ${data.signatoryName},</p>
        <p>Thank you for applying to the <strong>GU Venture Portal</strong>. We have received your onboarding application for <strong>${data.fundName}</strong>.</p>
        <p>Our team will verify your SEBI registration and activate your account within <strong>2–3 business days</strong>. You will receive another email once your account is approved.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="font-size:12px;color:#6b7280">GU Incubation & Venture Portal · GUSEC, Ahmedabad</p>
      </div>`
    ).catch(() => {});

    return firm;
  }

  async getMyFirm(userId: string) {
    return prisma.vcFirm.findUnique({ where: { userId } });
  }

  async updateMyFirm(userId: string, data: any) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId } });
    if (!firm) throw new Error("VC firm not found");
    return prisma.vcFirm.update({
      where: { id: firm.id },
      data: {
        description: data.description ?? firm.description,
        minTicket: data.minTicket !== undefined ? Number(data.minTicket) : firm.minTicket,
        maxTicket: data.maxTicket !== undefined ? Number(data.maxTicket) : firm.maxTicket,
        targetStages: data.targetStages ?? firm.targetStages,
        targetSectors: data.targetSectors ?? firm.targetSectors,
        website: data.website ?? firm.website,
      },
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAllFirms() {
    return prisma.vcFirm.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async approveFirm(firmId: string, adminId: string, status: string) {
    const firm = await prisma.vcFirm.update({
      where: { id: firmId },
      data: {
        status,
        approvedBy: adminId,
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
    });

    const subject =
      status === "APPROVED"
        ? "Your VC Account is Approved – GU Venture Portal"
        : "VC Application Status Update – GU Venture Portal";

    let html: string;
    if (status === "APPROVED") {
      // Generate a 7-day set-password token so VC can set their password on first login
      const rawToken = await AuthService.generateSetPasswordToken(firm.userId).catch(() => null);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const setPasswordLink = rawToken
        ? `${frontendUrl}/reset-password?token=${rawToken}`
        : `${frontendUrl}/vc/login`;

      html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#10b981">Account Approved ✓</h2>
        <p>Dear ${firm.signatoryName},</p>
        <p>Your venture capital fund <strong>${firm.fundName}</strong> has been <strong style="color:#10b981">approved</strong> on the GU Venture Portal.</p>
        <p>Click the button below to set your password and access the portal:</p>
        <p style="margin:24px 0">
          <a href="${setPasswordLink}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Set Password & Login →
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">This link expires in 7 days. After setting your password, use <strong>${firm.signatoryEmail}</strong> to log in.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="font-size:12px;color:#6b7280">GU Incubation & Venture Portal · GUSEC, Ahmedabad</p>
      </div>`;
    } else {
      html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#ef4444">Application Status Update</h2>
        <p>Dear ${firm.signatoryName},</p>
        <p>We regret to inform you that your application for <strong>${firm.fundName}</strong> has been <strong>rejected</strong> at this time.</p>
        <p>Please contact the GUSEC team for further clarification or to re-apply.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="font-size:12px;color:#6b7280">GU Incubation & Venture Portal · GUSEC, Ahmedabad</p>
      </div>`;
    }

    sendEmail(firm.signatoryEmail, subject, html).catch(() => {});

    return firm;
  }

  // ── Showcase ───────────────────────────────────────────────────────────────

  async getShowcase(vcUserId: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });

    const startups = await prisma.startupApplication.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
      },
      select: {
        id: true,
        startupName: true,
        briefAbout: true,
        mainSector: true,
        stage: true,
        fullName: true,
        userId: true,
        user: {
          select: {
            startupProgressReports: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { revenue: true },
            },
          },
        },
        formB: {
          select: {
            founders: { select: { name: true }, take: 1 },
          },
        },
      },
      take: 50,
    });

    // Get interests this VC already has
    const existingInterests = firm
      ? await prisma.vcInterest.findMany({
          where: { vcFirmId: firm.id },
          select: { id: true, startupId: true, pipelineStage: true, ndaAccepted: true },
        })
      : [];

    const interestMap = new Map(existingInterests.map((i: any) => [i.startupId, i]));

    return startups.map((s) => {
      const interest = interestMap.get(s.userId);
      const latestRevenue = s.user.startupProgressReports[0]?.revenue;
      return {
        id: s.userId,
        applicationId: s.id,
        name: s.startupName,
        description: s.briefAbout,
        sector: s.mainSector,
        stage: s.stage,
        founder: s.formB?.founders?.[0]?.name || s.fullName,
        revenueYTD: latestRevenue ? `₹${(latestRevenue / 100000).toFixed(1)} Lakhs` : "N/A",
        hasInterest: !!interest,
        interestId: interest?.id || null,
        pipelineStage: interest?.pipelineStage || null,
        ndaAccepted: interest?.ndaAccepted || false,
      };
    });
  }

  // ── Interests / Pipeline ───────────────────────────────────────────────────

  async getMyInterests(vcUserId: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) return [];
    return prisma.vcInterest.findMany({
      where: { vcFirmId: firm.id },
      include: {
        startup: {
          select: {
            startupApplication: {
              select: {
                startupName: true,
                mainSector: true,
                stage: true,
                briefAbout: true,
              },
            },
          },
        },
        outcome: true,
        meetings: { orderBy: { scheduledAt: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async expressInterest(vcUserId: string, startupId: string, notes?: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) throw new Error("VC firm not found");
    if (firm.status !== "APPROVED") throw new Error("VC account not approved yet");

    return prisma.vcInterest.upsert({
      where: { vcFirmId_startupId: { vcFirmId: firm.id, startupId } },
      update: { notes: notes || undefined },
      create: { vcFirmId: firm.id, startupId, notes: notes || null, pipelineStage: "LEAD" },
    });
  }

  async updateInterestStage(vcUserId: string, interestId: string, pipelineStage: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) throw new Error("VC firm not found");
    return prisma.vcInterest.update({
      where: { id: interestId, vcFirmId: firm.id },
      data: { pipelineStage },
    });
  }

  async acceptNda(vcUserId: string, interestId: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) throw new Error("VC firm not found");
    return prisma.vcInterest.update({
      where: { id: interestId, vcFirmId: firm.id },
      data: { ndaAccepted: true, ndaAcceptedAt: new Date() },
    });
  }

  // ── Meetings ───────────────────────────────────────────────────────────────

  async getMyMeetings(vcUserId: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) return [];
    return prisma.vcMeeting.findMany({
      where: { vcFirmId: firm.id },
      include: {
        startup: {
          select: {
            startupApplication: { select: { startupName: true } },
          },
        },
        interest: { select: { pipelineStage: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async scheduleMeeting(vcUserId: string, data: any) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) throw new Error("VC firm not found");

    const scheduledAt = new Date(data.scheduledAt);

    // Build Google Calendar link
    const calendarLink = this.buildGoogleCalendarLink({
      title: data.title,
      startTime: scheduledAt,
      durationMins: data.durationMins || 60,
      location: data.mode === "ONLINE" ? (data.meetingLink || "") : (data.location || ""),
      description: `VC Meeting via GUSEC Incubation Portal. Fund: ${firm.fundName}`,
    });

    return prisma.vcMeeting.create({
      data: {
        vcFirmId: firm.id,
        startupId: data.startupId,
        interestId: data.interestId || null,
        title: data.title,
        scheduledAt,
        durationMins: data.durationMins || 60,
        mode: data.mode || "ONLINE",
        meetingLink: data.meetingLink || null,
        calendarLink,
        location: data.location || null,
        notes: data.notes || null,
        status: "SCHEDULED",
      },
    });
  }

  async updateMeeting(vcUserId: string, meetingId: string, data: any) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) throw new Error("VC firm not found");
    return prisma.vcMeeting.update({
      where: { id: meetingId, vcFirmId: firm.id },
      data: {
        status: data.status,
        notes: data.notes,
        meetingLink: data.meetingLink,
      },
    });
  }

  // ── Investment Outcome ─────────────────────────────────────────────────────

  async recordOutcome(vcUserId: string, interestId: string, data: any) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) throw new Error("VC firm not found");

    await prisma.vcInterest.update({
      where: { id: interestId, vcFirmId: firm.id },
      data: { pipelineStage: "FUNDED" },
    });

    return prisma.vcInvestmentOutcome.upsert({
      where: { interestId },
      update: {
        amountInr: parseFloat(data.amountInr),
        instrumentType: data.instrumentType,
        investorName: data.investorName,
        closedAt: data.closedAt ? new Date(data.closedAt) : new Date(),
        notes: data.notes || null,
      },
      create: {
        interestId,
        amountInr: parseFloat(data.amountInr),
        instrumentType: data.instrumentType,
        investorName: data.investorName,
        closedAt: data.closedAt ? new Date(data.closedAt) : new Date(),
        notes: data.notes || null,
      },
    });
  }

  // ── Dashboard stats ────────────────────────────────────────────────────────

  async getDashboardStats(vcUserId: string) {
    const firm = await prisma.vcFirm.findUnique({ where: { userId: vcUserId } });
    if (!firm) return { activeDeals: 0, meetings: 0, totalInvested: 0 };

    const [interests, upcomingMeetings, outcomes] = await Promise.all([
      prisma.vcInterest.count({ where: { vcFirmId: firm.id, pipelineStage: { not: "FUNDED" } } }),
      prisma.vcMeeting.count({ where: { vcFirmId: firm.id, status: "SCHEDULED", scheduledAt: { gte: new Date() } } }),
      prisma.vcInvestmentOutcome.findMany({
        where: { interest: { vcFirmId: firm.id } },
        select: { amountInr: true },
      }),
    ]);

    const totalInvested = outcomes.reduce((sum, o) => sum + o.amountInr, 0);

    return { activeDeals: interests, meetings: upcomingMeetings, totalInvested };
  }

  // ── Startup side ───────────────────────────────────────────────────────────

  async getStartupIncomingRequests(startupUserId: string) {
    return prisma.vcInterest.findMany({
      where: { startupId: startupUserId },
      include: {
        vcFirm: { select: { fundName: true, website: true, targetSectors: true, targetStages: true } },
        outcome: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildGoogleCalendarLink(opts: {
    title: string;
    startTime: Date;
    durationMins: number;
    location: string;
    description: string;
  }) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const end = new Date(opts.startTime.getTime() + opts.durationMins * 60000);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: opts.title,
      dates: `${fmt(opts.startTime)}/${fmt(end)}`,
      details: opts.description,
      location: opts.location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
}
