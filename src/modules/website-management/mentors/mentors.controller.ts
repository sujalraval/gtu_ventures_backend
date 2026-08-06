import prisma from '../../../lib/prisma';

class MentorsController {
  async getAll(req, res) {
    try {
      const mentors = await prisma.webMentor.findMany({
        orderBy: { id: 'desc' }
      });
      res.json(mentors);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const { id } = req.params;
      const mentor = await prisma.webMentor.findUnique({ where: { id: parseInt(id) } });
      if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
      res.json(mentor);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const data = { ...req.body };
      const mentor = await prisma.webMentor.create({ data });
      res.status(201).json(mentor);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      req.auditBefore = await prisma.webMentor.findUnique({ where: { id: parseInt(id) } });
      
      const mentor = await prisma.webMentor.update({
        where: { id: parseInt(id) },
        data: req.body
      });
      res.json(mentor);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await prisma.webMentor.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Mentor deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MentorsController();
