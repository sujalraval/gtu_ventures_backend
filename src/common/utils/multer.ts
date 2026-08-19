import multer from 'multer';
import path from 'path';

import { ensureUploadsDir } from '../config/paths';

// Resolved from UPLOADS_DIR so production can keep files outside the directory
// the deploy rsyncs over. Previously this was the relative string 'uploads/',
// which resolved against cwd — i.e. inside the deploy target.
const uploadDir = ensureUploadsDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf|doc|docx|svg|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  },
});

/**
 * Spreadsheet uploads for bulk import. Memory storage on purpose: the file is
 * parsed and discarded, so it never touches the filesystem — nothing to clean
 * up, and no half-imported sheets accumulating on disk.
 */
export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    cb(new Error('Please upload an .xlsx or .csv file'));
  },
});

/**
 * Bulk logo upload — many image files in one request, written straight to the
 * uploads directory. Separate from `upload` so the single-file endpoints keep
 * their own limits.
 */
export const uploadManyImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 500 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpe?g|png|svg|webp|gif)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    cb(new Error(`${file.originalname} is not an image`));
  },
});
