import { request } from './client'

export interface HealthStatus {
  status: 'ok' | 'error' | string
  database?: 'ok' | 'error' | string
  [key: string]: unknown
}

/** Calls GET /api/health on the Linkdrop API. */
export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/api/health')
}
