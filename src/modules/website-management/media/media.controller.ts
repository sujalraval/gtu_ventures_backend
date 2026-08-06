import prisma from '../../../lib/prisma';

class MediaController {
  async upload(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      // Note: In production, URL might include domain or bucket path
      const url = `/uploads/${req.file.filename}`;

      const media = await prisma.webMedia.create({
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: url,
          altText: req.body.altText || null
        }
      });

      res.status(201).json(media);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const media = await prisma.webMedia.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(media);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const media = await prisma.webMedia.findUnique({ where: { id: parseInt(id) } });
      
      if (!media) return res.status(404).json({ error: 'Media not found' });
      if (media.refCount > 0) return res.status(400).json({ error: 'Cannot delete media currently in use.' });

      // Delete file from disk
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../../uploads', media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await prisma.webMedia.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Media deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MediaController();
