import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:5000/api';

const IDs = {
  "institutionId": "3a45c421-ad29-4d22-adb7-dd39445c5cda",
  "departmentId": "e4f4e2b3-3e20-4a20-9aa8-fdb3a454bff2",
  "designationId": "e369d0f2-68e1-4f61-a6a4-adf67454cf66",
  "roleId": "823295bd-74f8-4ee2-bf3b-3af55487b7fe",
  "countryId": "1bccefd0-1078-4e51-9b03-64f9caf21615",
  "stateId": "a6562445-cb74-4e87-8bc7-97fe64e04c07",
  "cityId": "30c59f06-b1b7-41ec-908b-55b46c79c7bb",
  "reportingUserId": "cc77af5c-52c3-4aff-9138-3ae017a4a6c0",
  "countryName": "India",
  "stateName": "Gujarat",
  "cityName": "Ahmedabad"
};

async function main() {
  try {
    // 1. Create User
    console.log('Creating user...');
    const userPayload = {
      personal: {
        title: "dr",
        firstName: "Riddhi",
        lastName: "Raval",
        gender: "female",
        dob: "1990-05-15",
        pob: "Ahmedabad",
        maritalStatus: "single",
        category: "gen",
        bloodGroup: "O+",
        pan: "ABCDE1234G",
        aadhaar: "123456789013",
        fatherSpouseName: "Bharatkumar Raval",
        email: "riddhi.raval.new@gtu.edu.in",
        phone: "9876543210",
        staffCode: "GTU-001N",
        punchId: "P-001N",
        shift: "General",
        policy: "Standard",
        status: "active",
        isPartTime: false,
        isExternalStaff: false
      },
      department: {
        institutionId: IDs.institutionId,
        departmentId: IDs.departmentId,
        designationId: IDs.designationId,
        dateOfJoining: "2024-03-01",
        leaveDate: null,
        isDefault: true
      },
      roles: {
        roleId: IDs.roleId,
        reportLevel1: IDs.reportingUserId,
        reportLevel2: IDs.reportingUserId,
        reportLevel3: IDs.reportingUserId,
        isDefault: true
      },
      bank: {
        bankName: "SBI",
        accountHolder: "Riddhi Raval",
        accountNo: "123456789012",
        ifsc: "SBIN0001234",
        branchName: "Ahmedabad",
        status: "active"
      },
      leave: [
        { academicYear: "2024-25", leaveType: "CL", totalLeave: 12 },
        { academicYear: "2024-25", leaveType: "EL", totalLeave: 15 },
        { academicYear: "2024-25", leaveType: "SL", totalLeave: 10 }
      ],
      experience: [
        { sector: "Higher Education", subSector: "Research", institutionName: "GTU", yearsOfExp: 5 }
      ],
      education: {
        qualification: "PhD",
        passingDate: "2020-01-01"
      },
      address: {
        residential: {
          addressLine: "123, GTU Colony",
          city: IDs.cityName,
          state: IDs.stateName,
          country: IDs.countryName,
          pinCode: "380001"
        },
        communication: {
          addressLine: "123, GTU Colony",
          city: IDs.cityName,
          state: IDs.stateName,
          country: IDs.countryName,
          pinCode: "380001"
        },
        sameAsResidential: true
      },
      professionalMetrics: {
        technicalSkills: "React, TypeScript, AI",
        domainExpertise: "ERP Systems",
        certifications: "AWS Certified"
      }
    };

    const userRes = await axios.post(`${API_URL}/users`, userPayload);
    const userId = userRes.data.data.id;
    console.log('User created with ID:', userId);

    // 2. Upload Documents
    console.log('Uploading documents...');
    const downloadsPath = 'C:\\Users\\riddh\\Downloads';
    const form = new FormData();
    
    const photoPath = path.join(downloadsPath, 'logo.png');
    if (fs.existsSync(photoPath)) form.append('photo', fs.createReadStream(photoPath));
    
    const sigPath = path.join(downloadsPath, 'Screenshot 2026-03-17 140857.png');
    if (fs.existsSync(sigPath)) form.append('signature', fs.createReadStream(sigPath));
    
    const esignPath = path.join(downloadsPath, 'Screenshot 2026-03-17 110724.png');
    if (fs.existsSync(esignPath)) form.append('esign', fs.createReadStream(esignPath));
    
    const supportingFiles = ['1.pdf', 'marksheet.pdf', 'transactions.csv'];
    supportingFiles.forEach(file => {
      const p = path.join(downloadsPath, file);
      if (fs.existsSync(p)) form.append('supporting', fs.createReadStream(p));
    });

    const uploadRes = await axios.post(`${API_URL}/users/${userId}/documents`, form, {
      headers: form.getHeaders()
    });
    
    console.log('Upload result:', uploadRes.data);
    console.log('SUCCESS: Admin user created and documents uploaded.');

  } catch (error: any) {
    if (error.response) {
      console.error('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

main();
