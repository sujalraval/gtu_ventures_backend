import path from 'path';
import fs from 'fs';

/**
 * Where uploaded files live.
 *
 * Set UPLOADS_DIR to a path OUTSIDE the deployment directory in production.
 * The deploy rsyncs the repo over that directory with --delete, and uploads are
 * gitignored — so anything stored inside it is destroyed on every deploy. That
 * is not hypothetical: it wiped every pitch deck, ID proof and image on
 * 18 Aug 2026. Keeping the files elsewhere makes the deploy structurally
 * incapable of reaching them, rather than relying on an exclude list.
 *
 * The default keeps the historical location (<project root>/uploads) so local
 * development and existing installs work unchanged.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '../../../uploads');

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

/** Maps a stored web path ("/uploads/x.png") to a file on disk, or null. */
export function resolveUploadPath(webPath?: string | null): string | null {
  if (!webPath || typeof webPath !== 'string') return null;
  if (/^https?:\/\//i.test(webPath)) return null;
  const clean = webPath.replace(/^\/+/, '');
  if (!clean.startsWith('uploads/')) return null;
  return path.join(UPLOADS_DIR, clean.slice('uploads/'.length));
}
