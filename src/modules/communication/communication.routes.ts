// @ts-nocheck
import { Router } from 'express';
import {
  getThreads,
  createNewThread,
  getMessages,
  sendMessage,
  getApplicationThread,
  getContacts,
  getUnreadMessages,
} from './communication.controller';
import {
  AnnouncementController,
  TemplateController,
  NotificationLogController,
} from './communication2.controller';
import {
  EventAnnouncementAdminController,
  EventAnnouncementStartupController,
} from './event-announcement.controller';
import { AnnouncementTypeController } from './announcement-type.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ── In-platform messaging ─────────────────────────────────────────────────────
router.get('/contacts', authenticate, getContacts);
router.get('/unread-messages', authenticate, getUnreadMessages);
router.get('/threads', authenticate, getThreads);
router.post('/threads', authenticate, createNewThread);
router.get('/threads/:threadId/messages', authenticate, getMessages);
router.post('/threads/:threadId/messages', authenticate, sendMessage);
router.get('/applications/:applicationId/thread', authenticate, getApplicationThread);

// ── Announcements (admin) ─────────────────────────────────────────────────────
router.get('/announcements', authenticate, authorize(ADMIN_ROLES), AnnouncementController.getAll);
router.get('/announcements/:id', authenticate, authorize(ADMIN_ROLES), AnnouncementController.getById);
router.post('/announcements', authenticate, authorize(ADMIN_ROLES), AnnouncementController.send);
router.post('/announcements/preview-audience', authenticate, authorize(ADMIN_ROLES), AnnouncementController.previewAudience);

// ── In-app notification feed (any logged-in user) ────────────────────────────
router.get('/notifications/feed', authenticate, AnnouncementController.getMyFeed);
router.get('/notifications/unread-count', authenticate, AnnouncementController.getUnreadCount);
router.patch('/notifications/:logId/read', authenticate, AnnouncementController.markRead);

// ── Notification templates (admin) ───────────────────────────────────────────
router.get('/templates', authenticate, authorize(ADMIN_ROLES), TemplateController.getAll);
router.get('/templates/:id', authenticate, authorize(ADMIN_ROLES), TemplateController.getById);
router.post('/templates', authenticate, authorize(ADMIN_ROLES), TemplateController.create);
router.put('/templates/:id', authenticate, authorize(ADMIN_ROLES), TemplateController.update);
router.delete('/templates/:id', authenticate, authorize(ADMIN_ROLES), TemplateController.delete);
router.post('/templates/:id/preview', authenticate, authorize(ADMIN_ROLES), TemplateController.preview);

// ── Notification logs (admin) ─────────────────────────────────────────────────
router.get('/logs', authenticate, authorize(ADMIN_ROLES), NotificationLogController.getAll);
router.get('/logs/stats', authenticate, authorize(ADMIN_ROLES), NotificationLogController.getStats);

// ── Event Announcements (admin CRUD + attendance) ─────────────────────────────
// Announcement type management (public GET, admin CRUD)
router.get('/event-announcements/types', AnnouncementTypeController.getAll);
router.post('/event-announcements/types', authenticate, authorize(ADMIN_ROLES), AnnouncementTypeController.create);
router.put('/event-announcements/types/:id', authenticate, authorize(ADMIN_ROLES), AnnouncementTypeController.update);
router.delete('/event-announcements/types/:id', authenticate, authorize(ADMIN_ROLES), AnnouncementTypeController.delete);

router.get('/event-announcements/stats', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.getStats);
router.get('/event-announcements', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.getAll);
router.get('/event-announcements/:id', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.getById);
router.post('/event-announcements', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.create);
router.put('/event-announcements/:id', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.update);
router.delete('/event-announcements/:id', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.delete);
router.patch('/event-announcements/:announcementId/rsvps/:startupId/attendance', authenticate, authorize(ADMIN_ROLES), EventAnnouncementAdminController.markAttendance);

// ── Event Announcements (startup: view + RSVP + feedback) ─────────────────────
router.get('/startup/event-announcements', authenticate, EventAnnouncementStartupController.getAll);
router.post('/startup/event-announcements/:id/rsvp', authenticate, EventAnnouncementStartupController.rsvp);
router.delete('/startup/event-announcements/:id/rsvp', authenticate, EventAnnouncementStartupController.cancelRsvp);
router.post('/startup/event-announcements/:id/feedback', authenticate, EventAnnouncementStartupController.submitFeedback);

export default router;
