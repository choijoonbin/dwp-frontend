import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------

export type MainHealthPayload = string;

export async function getMainHealth() {
  const res = await axiosInstance.get<ApiResponse<MainHealthPayload>>('/api/main/health');
  return res.data;
}

