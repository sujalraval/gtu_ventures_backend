import { Router } from 'express';
import { LocationsController } from './locations.controller';

const router = Router();

router.get('/countries', LocationsController.getCountries);
router.get('/states/:countryId', LocationsController.getStates);
router.get('/districts/:stateId', LocationsController.getDistricts);
router.get('/cities/:districtId', LocationsController.getCities);
router.get('/cities/state/:stateId', LocationsController.getCitiesByState);

export default router;
