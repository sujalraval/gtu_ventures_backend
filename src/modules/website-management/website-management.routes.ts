import { Router } from 'express';

const websiteManagementRouter = Router();

import announcementsRoutes from './announcements/announcements.routes';
websiteManagementRouter.use('/announcements', announcementsRoutes);

import auditRoutes from './audit/audit.routes';
websiteManagementRouter.use('/audit', auditRoutes);

import authRoutes from './auth/auth.routes';
websiteManagementRouter.use('/auth', authRoutes);

import eventsRoutes from './events/events.routes';
websiteManagementRouter.use('/events', eventsRoutes);

import labsRoutes from './labs/labs.routes';
websiteManagementRouter.use('/labs', labsRoutes);

import leadsRoutes from './leads/leads.routes';
websiteManagementRouter.use('/leads', leadsRoutes);

import mediaRoutes from './media/media.routes';
websiteManagementRouter.use('/media', mediaRoutes);

import mentorsRoutes from './mentors/mentors.routes';
websiteManagementRouter.use('/mentors', mentorsRoutes);

import mousRoutes from './mous/mous.routes';
websiteManagementRouter.use('/mous', mousRoutes);

import orgsRoutes from './orgs/orgs.routes';
websiteManagementRouter.use('/orgs', orgsRoutes);

import partnersRoutes from './partners/partners.routes';
websiteManagementRouter.use('/partners', partnersRoutes);

import resourcesRoutes from './resources/resources.routes';
websiteManagementRouter.use('/resources', resourcesRoutes);

import schemesRoutes from './schemes/schemes.routes';
websiteManagementRouter.use('/schemes', schemesRoutes);

import settingsRoutes from './settings/settings.routes';
websiteManagementRouter.use('/settings', settingsRoutes);

import startupsRoutes from './startups/startups.routes';
websiteManagementRouter.use('/startups', startupsRoutes);

import storiesRoutes from './stories/stories.routes';
websiteManagementRouter.use('/stories', storiesRoutes);

import teamRoutes from './team/team.routes';
websiteManagementRouter.use('/team', teamRoutes);

import testimonialsRoutes from './testimonials/testimonials.routes';
websiteManagementRouter.use('/testimonials', testimonialsRoutes);

import usersRoutes from './users/users.routes';
websiteManagementRouter.use('/users', usersRoutes);

import verticalsRoutes from './verticals/verticals.routes';
websiteManagementRouter.use('/verticals', verticalsRoutes);

export default websiteManagementRouter;
