import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();

const KYC_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://api.quickekyc.com/api/v1'
    : 'https://sandbox.quickekyc.com/api/v1';

async function proxyToKyc(endpoint: string, body: object, res: Response) {
  const apiKey = process.env.QUICK_EKYC_API_KEY || '';
  const url = `${KYC_BASE}${endpoint}`;
  console.log(`[KYC] Proxying POST ${url}`);

  try {
    const response = await axios.post(
      url,
      { ...body, key: apiKey },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    console.log('[KYC] Response:', JSON.stringify(response.data));
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    let status = error.response?.status || 500;
    const data = error.response?.data || { message: error.message || 'KYC proxy error' };
    // Never forward 401 from QuickeKYC — it would log the user out on frontend
    if (status === 401) status = 400;
    console.error('[KYC] Error:', status, JSON.stringify(data));
    return res.status(status).json(data);
  }
}

router.post('/aadhaar-v2/generate-otp', authenticate, async (req: Request, res: Response) => {
  const endpoint = process.env.NODE_ENV === 'production'
    ? '/aadhaar-v2/generate-otp-sp'
    : '/aadhaar-v2/generate-otp';
  await proxyToKyc(endpoint, req.body, res);
});

router.post('/aadhaar-v2/submit-otp', authenticate, async (req: Request, res: Response) => {
  const body = { ...req.body, request_id: Number(req.body.request_id) };
  const endpoint = process.env.NODE_ENV === 'production'
    ? '/aadhaar-v2/submit-otp-sp'
    : '/aadhaar-v2/submit-otp';
  await proxyToKyc(endpoint, body, res);
});

export default router;
