import { Router } from 'express';
import { AdminMastersController } from './admin-masters.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { UpdateCenterProfileSchema } from './admin-masters.schema';

const router = Router();

// Institutions
router.get('/institutions', authenticate, AdminMastersController.getInstitutions);
router.post('/institutions', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createInstitution);
router.delete('/institutions/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteInstitution);

// Departments
router.get('/departments', authenticate, AdminMastersController.getDepartments);
router.post('/departments', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createDepartment);
router.delete('/departments/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteDepartment);

// Designations
router.get('/designations', authenticate, AdminMastersController.getDesignations);
router.post('/designations', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createDesignation);
router.delete('/designations/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteDesignation);

// Org Roles
router.get('/org-roles', authenticate, AdminMastersController.getOrgRoles);
router.post('/org-roles', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createOrgRole);
router.put('/org-roles/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.updateOrgRole);
router.delete('/org-roles/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteOrgRole);

// Sectors
router.get('/sectors', authenticate, AdminMastersController.getSectors);
router.post('/sectors', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createSector);
router.delete('/sectors/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteSector);

// SubSectors
router.get('/sub-sectors', authenticate, AdminMastersController.getSubSectors);
router.post('/sub-sectors', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createSubSector);
router.delete('/sub-sectors/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteSubSector);

// Incubation Center Profile
router.get('/center-profile', authenticate, AdminMastersController.getCenterProfile);
router.post('/center-profile', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(UpdateCenterProfileSchema), AdminMastersController.updateCenterProfile);

// Allocation Heads
router.get('/allocation-heads', authenticate, AdminMastersController.getAllocationHeads);
router.post('/allocation-heads', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.createAllocationHead);
router.delete('/allocation-heads/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AdminMastersController.deleteAllocationHead);

export default router;
