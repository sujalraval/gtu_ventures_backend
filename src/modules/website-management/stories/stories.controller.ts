import prisma from '../../../lib/prisma';

class StoriesController {
  async getAll(req, res) {
    try {
      const items = await prisma.webStory.findMany({ orderBy: { id: 'desc' } });
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const item = await prisma.webStory.findUnique({
        where: { id: parseInt(req.params.id) }
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const item = await prisma.webStory.create({ data: req.body });
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const item = await prisma.webStory.update({
        where: { id: parseInt(req.params.id) },
        data: req.body
      });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      await prisma.webStory.delete({
        where: { id: parseInt(req.params.id) }
      });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new StoriesController();
