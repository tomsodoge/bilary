import axios from 'axios';
import type {
  ConnectionStatus,
  Invoice,
  SyncResponse,
  InvoiceFilters,
  ExportOptions,
  AccountInfo
} from '../types/invoice';

// Get API base URL from environment, fallback to localhost only in development
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

// Always enforce HTTPS in production to prevent Mixed Content (browser blocks http from https pages)
function toHttpsIfNeeded(url: string): string {
  if (!url || import.meta.env.DEV) return url;
  return url.replace(/^http:\/\//i, 'https://');
}
const validatedApiBaseUrl = rawApiBaseUrl ? toHttpsIfNeeded(rawApiBaseUrl) : '';

// DEBUG: Log the API base URL in production to verify it's correct
if (!import.meta.env.DEV) {
  console.log('[API Client] Raw VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('[API Client] Validated API Base URL:', validatedApiBaseUrl);
  console.log('[API Client] Is DEV:', import.meta.env.DEV);
  console.log('[API Client] Mode:', import.meta.env.MODE);
}

if (!import.meta.env.DEV && !validatedApiBaseUrl) {
  console.error('[API Client] VITE_API_BASE_URL is not set. Set it in Vercel Environment Variables.');
}

const apiClient = axios.create({
  baseURL: validatedApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s default for normal requests
});

// Request interceptor: force HTTPS on every request when page is HTTPS (Mixed Content fix)
// Axios may not put instance baseURL on config, so we fix the effective base URL here.
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window === 'undefined') return config;
    if (window.location?.protocol !== 'https:') return config;
    const base = (config.baseURL ?? apiClient.defaults.baseURL) as string | undefined;
    if (typeof base === 'string' && base.startsWith('http://')) {
      console.warn('[API Client] Fixing HTTP to HTTPS in request:', base);
      config.baseURL = base.replace(/^http:\/\//i, 'https://');
    }
    return config;
  },
  (error) => Promise.reject(error)
);
