import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function main() {
  try {
    const inst = await axios.get(`${API_URL}/admin-masters/institutions`);
    const dept = await axios.get(`${API_URL}/admin-masters/departments`);
    const desig = await axios.get(`${API_URL}/admin-masters/designations`);
    const roles = await axios.get(`${API_URL}/admin-masters/org-roles`);
    const countries = await axios.get(`${API_URL}/locations/countries`);
    
    const india = countries.data.find((c: any) => c.name === 'India');
    let gujarat: any = null;
    let ahmedabad: any = null;
    
    if (india) {
      const states = await axios.get(`${API_URL}/locations/states/${india.id}`);
      gujarat = states.data.find((s: any) => s.name === 'Gujarat');
      if (gujarat) {
        const cities = await axios.get(`${API_URL}/locations/cities/${gujarat.id}`);
        ahmedabad = cities.data.find((c: any) => c.name === 'Ahmedabad');
      }
    }
    
    const users = await axios.get(`${API_URL}/users`);
    const adminUser = users.data.find((u: any) => u.name === 'John 2 Doe') || users.data[0];

    const result = {
      institutionId: inst.data[0]?.id,
      departmentId: dept.data[0]?.id,
      designationId: desig.data[0]?.id,
      roleId: roles.data[0]?.id,
      countryId: india?.id,
      stateId: gujarat?.id,
      cityId: ahmedabad?.id,
      reportingUserId: adminUser?.id,
      countryName: india?.name,
      stateName: gujarat?.name,
      cityName: ahmedabad?.name
    };
    
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
