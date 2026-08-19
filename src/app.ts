import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { UPLOADS_DIR } from './common/config/paths';
import fs from 'fs';
import { config } from './common/config/env';
import { errorHandler } from './common/middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import schemeRoutes from './modules/schemes/schemes.routes';
import applicationRoutes from './modules/applications/applications.routes';
import locationRoutes from './modules/locations/locations.routes';
import adminMasterRoutes from './modules/admin-masters/admin-masters.routes';
import userRoutes from './modules/users/users.routes';
import permissionRoutes from './modules/permissions/permissions.routes';
import agreementTemplateRoutes from './modules/agreement-templates/agreement-templates.routes';
import grantRoutes from './modules/grants/grants.routes';
import startupAllocationRoutes from './modules/startup-allocations/startup-allocations.routes';
import agreementRoutes from './modules/agreements/agreements.routes';
import milestoneRoutes from './modules/milestones/milestones.routes';
import sprRoutes from './modules/spr-monitoring/spr-monitoring.routes';
import ucRoutes from './modules/uc/uc.routes';
import cohortRoutes from './modules/cohorts/cohorts.routes';
import coworkingRoutes from './modules/coworking/coworking.routes';
import financeRoutes from './modules/finance/finance.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import alumniRoutes from './modules/alumni/alumni.routes';
import communicationRoutes from './modules/communication/communication.routes';
import mentorsRoutes from './modules/mentors/mentors.routes';
import eventRoutes from './modules/events/events.routes';
import kycRoutes from './modules/kyc/kyc.routes';
import vcRoutes from './modules/vc/vc.routes';
import websiteManagementRoutes from './modules/website-management/website-management.routes';
const app: Application = express();

// Trust CloudPanel/Nginx proxy
app.set('trust proxy', 1);

// Security & Optimization Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false, // Allow iframes for previewing documents
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["'self'", "http://localhost:8080", "http://localhost:5173", "http://localhost:3000", "http://localhost:5000"],
      "frame-src": ["'self'", "http://localhost:8080", "http://localhost:5173", "http://localhost:3000", "http://localhost:5000", "https://apply.datarsoft.tech"],
      "img-src": ["'self'", "data:", "http://localhost:8080", "http://localhost:5173", "http://localhost:3000", "http://localhost:5000", "https://apply.datarsoft.tech"],
      "object-src": ["'self'"],
    },
    // 
  },
}));
app.use(compression());
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10000, // Limit each IP to 10000 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
if (config.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}
// CORS Configuration
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:8080'];
const allowedOrigins = config.ALLOWED_ORIGINS.length > 0 
  ? Array.from(new Set([...config.ALLOWED_ORIGINS, ...defaultOrigins]))
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    console.log('CORS Origin:', origin);
    console.log('Allowed Origins:', allowedOrigins);
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve Static Files from 'public' (Frontend Build)
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spaces', coworkingRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/admin-masters', adminMasterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/agreement-templates', agreementTemplateRoutes);
app.use('/api/grants', grantRoutes);
app.use('/api/startup-allocations', startupAllocationRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/spr-monitoring', sprRoutes);
app.use('/api/uc', ucRoutes);
app.use('/api/cohorts', cohortRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/mentors', mentorsRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/vc', vcRoutes);
app.use('/api/website-management', websiteManagementRoutes);

// TEMPORARY: Seed Super Admin - REMOVE AFTER USE
app.post('/api/seed-admin', async (req: Request, res: Response) => {
  try {
    const { default: prisma } = await import('./lib/prisma');
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const role = await prisma.orgRole.upsert({

      where: { code: 'SUPER_ADMIN' },
      update: {},
      create: { name: 'Super Admin', code: 'SUPER_ADMIN', description: 'Full system access' },
    });
    const admin = await prisma.user.upsert({
      where: { email: 'admin@gtu.edu.in' },
      update: { password: hashedPassword, role: 'SUPER_ADMIN', isSetupComplete: true, isActive: true },
      create: { email: 'admin@gtu.edu.in', password: hashedPassword, name: 'Super Admin', role: 'SUPER_ADMIN', isSetupComplete: true, isActive: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: role.id } },
      update: {},
      create: { userId: admin.id, roleId: role.id, isDefault: true },
    });
    await prisma.$disconnect();
    res.json({ success: true, message: 'Super Admin created!', email: admin.email });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Backend is live',
    timestamp: new Date().toISOString()
  });
});

// Handle SPA routing - Send all other requests to index.html if it exists
app.get(/.*/, (req: Request, res: Response) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: `Route ${req.originalUrl} not found`,
    });
  }
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
