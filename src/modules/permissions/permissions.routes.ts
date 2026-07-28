import { Router } from "express";
import { permissionsController } from "./permissions.controller";
import { authenticate, authorize, authorizePermission } from '../../common/middleware/auth.middleware';

const router = Router();

router.post('/seed-modules', authenticate, permissionsController.seedModules);
router.get('/modules', authenticate, authorizePermission('users', 'view'), permissionsController.getModules);
router.get('/roles', authenticate, permissionsController.getRoles);
router.post('/roles', authenticate, authorizePermission('users', 'create'), permissionsController.createRole);
router.put('/roles/:id', authenticate, authorizePermission('users', 'edit'), permissionsController.updateRole);
router.put('/roles/:id/permissions', authenticate, authorizePermission('users', 'edit'), permissionsController.updateRolePermissions);
router.get('/user-mappings', authenticate, permissionsController.getUserMappings);
router.post('/map-role', authenticate, permissionsController.mapRoleToUser);
router.post('/remove-role', authenticate, permissionsController.removeRoleFromUser);

export default router;
