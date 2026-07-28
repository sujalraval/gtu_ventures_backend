import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function main() {
  try {
    const institutions = await axios.get(`${API_URL}/admin-masters/institutions`);
    const departments = await axios.get(`${API_URL}/admin-masters/departments`);
    const designations = await axios.get(`${API_URL}/admin-masters/designations`);
    const roles = await axios.get(`${API_URL}/admin-masters/org-roles`);
    const countries = await axios.get(`${API_URL}/locations/countries`);
    
    console.log('--- Institutions ---');
    console.log(institutions.data.slice(0, 3));
    
    console.log('\n--- Departments ---');
    console.log(departments.data.slice(0, 3));
    
    console.log('\n--- Designations ---');
    console.log(designations.data.slice(0, 3));
    
    console.log('\n--- Roles ---');
    console.log(roles.data.slice(0, 3));
    
    console.log('\n--- Countries ---');
    console.log(countries.data.slice(0, 3));

    if (countries.data.length > 0) {
      const states = await axios.get(`${API_URL}/locations/states/${countries.data[0].id}`);
      console.log('\n--- States (for ' + countries.data[0].name + ') ---');
      console.log(states.data.slice(0, 3));
      
      if (states.data.length > 0) {
        const cities = await axios.get(`${API_URL}/locations/cities/${states.data[0].id}`);
        console.log('\n--- Cities (for ' + states.data[0].name + ') ---');
        console.log(cities.data.slice(0, 3));
      }
    }
    
    // Get existing users for reporting levels
    const users = await axios.get(`${API_URL}/users`);
    console.log('\n--- Users (for reporting) ---');
    console.log(users.data.slice(0, 3).map((u: any) => ({ id: u.id, name: u.name })));

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
