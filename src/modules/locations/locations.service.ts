import prisma from '../../lib/prisma';

export class LocationsService {
  static async getAllCountries() {
    return prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async getStatesByCountry(countryId: string) {
    return prisma.state.findMany({
      where: { countryId },
      orderBy: { name: 'asc' },
    });
  }

  static async getDistrictsByState(stateId: string) {
    return prisma.district.findMany({
      where: { stateId },
      orderBy: { name: 'asc' },
    });
  }

  static async getCitiesByDistrict(districtId: string) {
    return prisma.city.findMany({
      where: { districtId },
      orderBy: { name: 'asc' },
    });
  }

  static async getCitiesByState(stateId: string) {
    return prisma.city.findMany({
      where: {
        district: {
          stateId
        }
      },
      orderBy: { name: 'asc' },
    });
  }
}
