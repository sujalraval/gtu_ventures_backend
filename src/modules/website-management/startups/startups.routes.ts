// @ts-nocheck
import express from 'express';
const router = express.Router();
import startupsController from './startups.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
import { uploadSpreadsheet, uploadManyImages } from '../../../common/utils/multer';
import { buildTemplate, importStartups, attachLogos } from './startups.import';
const auditLog = (action) => (req: any, res: any, next: any) => next();

router.get('/', startupsController.getAll);

// ── Bulk import ──────────────────────────────────────────────────────────────
// Both above '/:id' so "import" is never read as an id.
router.get('/import/template', authenticateToken, async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const { buffer, filename } = await buildTemplate(format);
    res.setHeader(
      'Content-Type',
      format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Many logos at once, matched to startups by filename. Deliberately separate
// from the spreadsheet import: 1000 images cannot ride along in one request,
// and this can be re-run in batches until every startup has one.
router.post('/import/logos', authenticateToken, uploadManyImages.array('files', 500), async (req, res) => {
  try {
    const files = (req.files as any[]) || [];
    if (!files.length) return res.status(400).json({ error: 'No images uploaded' });
    const result = await attachLogos(
      files.map((f) => ({ originalname: f.originalname, webPath: `/uploads/${f.filename}` })),
      {
        dryRun: req.body?.dryRun === 'true' || req.body?.dryRun === true,
        overwrite: !(req.body?.overwrite === 'false' || req.body?.overwrite === false),
      },
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/import', authenticateToken, uploadSpreadsheet.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await importStartups(req.file.buffer, req.file.originalname, {
      mode: req.body?.mode === 'update' ? 'update' : 'skip',
      dryRun: req.body?.dryRun === 'true' || req.body?.dryRun === true,
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/approved-applications', authenticateToken, startupsController.getApprovedApplications);
router.get('/:id', startupsController.getOne);

router.post('/', authenticateToken, auditLog('Startup'), startupsController.create);
router.put('/:id', authenticateToken, auditLog('Startup'), startupsController.update);
router.delete('/:id', authenticateToken, auditLog('Startup'), startupsController.delete);

export default router;
