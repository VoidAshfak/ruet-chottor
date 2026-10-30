import {
  busNoticeListSchema,
  busNoticeSchema,
  type BusNoticeInputValues,
  busRouteListSchema,
  busRouteSchema,
  type BusRouteInputValues,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

const noContent = z.undefined();

export const busApi = {
  routes: (all = false) => apiRequest(`/bus/routes${all ? '?all=true' : ''}`, busRouteListSchema),
  route: (id: string) => apiRequest(`/bus/routes/${id}`, busRouteSchema),
  createRoute: (body: BusRouteInputValues) =>
    apiRequest('/bus/routes', busRouteSchema, { method: 'POST', body }),
  saveRoute: (id: string, body: BusRouteInputValues) =>
    apiRequest(`/bus/routes/${id}`, busRouteSchema, { method: 'PUT', body }),
  deleteRoute: (id: string) => apiRequest(`/bus/routes/${id}`, noContent, { method: 'DELETE' }),
  notices: (all = false) =>
    apiRequest(`/bus/notices${all ? '?all=true' : ''}`, busNoticeListSchema),
  createNotice: (body: BusNoticeInputValues) =>
    apiRequest('/bus/notices', busNoticeSchema, { method: 'POST', body }),
  deleteNotice: (id: string) => apiRequest(`/bus/notices/${id}`, noContent, { method: 'DELETE' }),
};
