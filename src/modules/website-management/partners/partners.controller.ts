import prisma from '../../../lib/prisma';

class PartnersController {
  async getAll(req, res) {
    try {
      const { type } = req.query;
      const filter = type ? { type } : {};
      
      const partners = await prisma.webPartner.findMany({
        where: filter,
        orderBy: { id: 'desc' }
      });
      res.json(partners);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const { id } = req.params;
      const partner = await prisma.webPartner.findUnique({ where: { id: parseInt(id) } });
      if (!partner) return res.status(404).json({ error: 'Partner not found' });
      res.json(partner);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const data = { ...req.body };
      const partner = await prisma.webPartner.create({ data });
      res.status(201).json(partner);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      req.auditBefore = await prisma.webPartner.findUnique({ where: { id: parseInt(id) } });
      
      const partner = await prisma.webPartner.update({
        where: { id: parseInt(id) },
        data: req.body
      });
      res.json(partner);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.webPartner.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Partner deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PartnersController();
