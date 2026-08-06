import prisma from '../../../lib/prisma';

class SettingsController {
  async getAll(req, res) {
    try {
      const settings = await prisma.webSetting.findMany();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      
      // We need before state for audit log
      req.auditBefore = await prisma.webSetting.findUnique({ where: { key } });

      const setting = await prisma.webSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value), description },
        create: { key, value: JSON.stringify(value), description }
      });
      
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new SettingsController();
