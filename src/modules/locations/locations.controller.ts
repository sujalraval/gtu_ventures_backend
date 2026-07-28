import { Request, Response } from 'express';
import { LocationsService } from './locations.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class LocationsController {
  static getCountries = asyncHandler(async (req: Request, res: Response) => {
    const countries = await LocationsService.getAllCountries();
    res.json({
      success: true,
      data: countries
    });
  });

  static getStates = asyncHandler(async (req: Request, res: Response) => {
    const states = await LocationsService.getStatesByCountry(req.params.countryId as string);
    res.json({
      success: true,
      data: states
    });
  });

  static getDistricts = asyncHandler(async (req: Request, res: Response) => {
    const districts = await LocationsService.getDistrictsByState(req.params.stateId as string);
    res.json({
      success: true,
      data: districts
    });
  });

  static getCities = asyncHandler(async (req: Request, res: Response) => {
    const cities = await LocationsService.getCitiesByDistrict(req.params.districtId as string);
    res.json({
      success: true,
      data: cities
    });
  });

  static getCitiesByState = asyncHandler(async (req: Request, res: Response) => {
    const cities = await LocationsService.getCitiesByState(req.params.stateId as string);
    res.json({
      success: true,
      data: cities
    });
  });
}
