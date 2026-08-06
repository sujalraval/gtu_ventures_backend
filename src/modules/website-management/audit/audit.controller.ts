import prisma from '../../../lib/prisma';

class AuditController {
  async getAll(req, res) {
    try {
      const logs = await prisma.webAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, role: true }
          }
        },
        take: 100 // Limit for performance, in reality we'd paginate
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AuditController();
