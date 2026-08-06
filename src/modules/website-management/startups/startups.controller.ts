import prisma from '../../../lib/prisma';

class StartupsController {
  async getAll(req, res) {
    try {
      const startups = await prisma.webStartup.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(startups);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const { id } = req.params;
      const startup = await prisma.webStartup.findUnique({ where: { id: parseInt(id) } });
      if (!startup) return res.status(404).json({ error: 'Startup not found' });
      res.json(startup);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const data = { ...req.body };
      const startup = await prisma.webStartup.create({ data });
      res.status(201).json(startup);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      req.auditBefore = await prisma.webStartup.findUnique({ where: { id: parseInt(id) } });
      
      const startup = await prisma.webStartup.update({
        where: { id: parseInt(id) },
        data: req.body
      });
      res.json(startup);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.webStartup.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Startup deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new StartupsController();
