import axios from 'axios';
import type {
  ConnectionStatus,
  Invoice,
  SyncResponse,
  InvoiceFilters,
  ExportOptions,
  AccountInfo
} from '../types/invoice';

// #region agent log – Hypothesis G: Intercept the actual XHR to see what URL the browser sends
if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: unknown[]) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('railway') || urlStr.includes('/api/')) {
      console.log('%c[DEBUG-XHR] open()', 'color: magenta; font-weight: bold', method, urlStr);
      if (urlStr.startsWith('http://')) {
        console.trace('%c[DEBUG-XHR] HTTP REQUEST ORIGIN TRACE:', 'color: red; font-weight: bold');
      }
    }
    return origOpen.call(this, method, url, ...(rest as [boolean, string?, string?]));
  };
}
// #endregion

// Get API base URL from environment, fallback to localhost only in development
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

// Always enforce HTTPS in production to prevent Mixed Content (browser blocks http from https pages)
function toHttpsIfNeeded(url: string): string {
  if (!url || import.meta.env.DEV) return url;
  return url.replace(/^http:\/\//i, 'https://');
}
const validatedApiBaseUrl = rawApiBaseUrl ? toHttpsIfNeeded(rawApiBaseUrl) : '';

// #region agent log – Hypothesis A,B,D: Check what values Vite embedded at build time
console.log('%c[DEBUG] BUILD_ID: 2026-02-17-v2', 'color: red; font-weight: bold');
console.log('%c[DEBUG] VITE_API_BASE_URL:', 'color: red', import.meta.env.VITE_API_BASE_URL);
console.log('%c[DEBUG] rawApiBaseUrl:', 'color: red', rawApiBaseUrl);
console.log('%c[DEBUG] validatedApiBaseUrl:', 'color: red', validatedApiBaseUrl);
console.log('%c[DEBUG] DEV:', 'color: red', import.meta.env.DEV);
console.log('%c[DEBUG] MODE:', 'color: red', import.meta.env.MODE);
console.log('%c[DEBUG] PROD:', 'color: red', import.meta.env.PROD);
// #endregion

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
// #region agent log – Hypothesis C,E: Check what axios instance holds
console.log('%c[DEBUG] apiClient.defaults.baseURL:', 'color: orange', apiClient.defaults.baseURL);
// #endregion

apiClient.interceptors.request.use(
  (config) => {
    // #region agent log – Hypothesis G,H: Log FLAT strings, not objects
    console.log('%c[DEBUG] Interceptor config.baseURL:', 'color: blue', config.baseURL);
    console.log('%c[DEBUG] Interceptor config.url:', 'color: blue', config.url);
    console.log('%c[DEBUG] Interceptor defaults.baseURL:', 'color: blue', apiClient.defaults.baseURL);
    // #endregion
    if (typeof window === 'undefined') return config;
    if (window.location?.protocol !== 'https:') return config;
    const base = (config.baseURL ?? apiClient.defaults.baseURL) as string | undefined;
    if (typeof base === 'string' && base.startsWith('http://')) {
      console.warn('%c[DEBUG] FIXING http to https:', 'color: red; font-weight: bold', base);
      config.baseURL = base.replace(/^http:\/\//i, 'https://');
    }
    // #region agent log – Hypothesis G: Log the full URL that axios WILL use
    const finalBase = config.baseURL ?? '';
    const finalUrl = config.url ?? '';
    const combinedUrl = finalUrl.startsWith('http') ? finalUrl : finalBase + finalUrl;
    console.log('%c[DEBUG] Interceptor COMBINED URL:', 'color: green; font-weight: bold', combinedUrl);
    // #endregion
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: clear error messages and enforce HTTPS
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = error.response?.data?.detail ?? error.message ?? 'An error occurred';
    if (typeof message === 'object') message = JSON.stringify(message);
    const status = error.response?.status;
    if (error.code === 'ECONNABORTED') {
      message = 'Zeitüberschreitung. Der Sync dauert zu lange – versuche einen kürzeren Zeitraum.';
    } else if (status && status >= 500) {
      message = 'Serverfehler. Bitte in ein paar Minuten erneut versuchen.';
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      message = status != null
        ? 'Netzwerkfehler. Bitte Internetverbindung prüfen.'
        : 'Verbindung zum Server fehlgeschlagen. Prüfe die Internetverbindung und ob die App (Railway) läuft.';
    }
    return Promise.reject(new Error(message));
  }
);

// Auth API
export const authAPI = {
  connect: async (email: string, password: string, imap_server?: string) => {
    const response = await apiClient.post<ConnectionStatus>('/api/auth/connect', {
      email,
      password,
      imap_server: imap_server || 'imap.gmail.com',
      imap_port: 993,
    });
    return response.data;
  },

  getStatus: async () => {
    // Short timeout so the app never hangs if the backend is unreachable (e.g. on first load)
    const response = await apiClient.get<ConnectionStatus>('/api/auth/status', {
      timeout: 12_000, // 12s
    });
    return response.data;
  },

  getAccounts: async () => {
    const response = await apiClient.get<AccountInfo[]>('/api/auth/accounts');
    return response.data;
  },

  removeAccount: async (userId: number) => {
    await apiClient.delete(`/api/auth/accounts/${userId}`);
  },
};

// Sync can take a long time (many emails, especially full year) – use 15 min timeout
const SYNC_TIMEOUT_MS = 15 * 60 * 1000;

// Invoices API
export const invoicesAPI = {
  sync: async (options?: { daysBack?: number; year?: number; includeAll?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.daysBack) params.append('days_back', String(options.daysBack));
    if (options?.year) params.append('year', String(options.year));
    if (options?.includeAll) params.append('include_all', 'true');
    
    const response = await apiClient.post<SyncResponse>(
      `/api/invoices/sync?${params.toString()}`,
      {},
      { timeout: SYNC_TIMEOUT_MS }
    );
    return response.data;
  },

  list: async (filters?: InvoiceFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.sender) params.append('sender', filters.sender);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.is_private !== undefined) params.append('is_private', String(filters.is_private));
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await apiClient.get<Invoice[]>(
      `/api/invoices?${params.toString()}`
    );
    return response.data;
  },

  get: async (id: number) => {
    const response = await apiClient.get<Invoice>(`/api/invoices/${id}`);
    return response.data;
  },

  update: async (id: number, data: { category?: string; is_private?: boolean }) => {
    const response = await apiClient.patch<Invoice>(`/api/invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    await apiClient.delete(`/api/invoices/${id}`);
  },

  getSenders: async () => {
    const response = await apiClient.get<Array<{ sender_email: string; sender_name: string }>>(
      '/api/invoices/senders/list'
    );
    return response.data;
  },
};

// Export API
export const exportAPI = {
  downloadZip: (options: ExportOptions) => {
    if (!validatedApiBaseUrl) {
      console.error('[Export API] Cannot download: API_BASE_URL is not set');
      return;
    }
    const base = (typeof window !== 'undefined' && window.location?.protocol === 'https:' && validatedApiBaseUrl.startsWith('http://'))
      ? validatedApiBaseUrl.replace(/^http:\/\//i, 'https://') : validatedApiBaseUrl;

    const params = new URLSearchParams({
      year: String(options.year),
      type: options.type,
    });
    
    if (options.month) {
      params.append('month', String(options.month));
    }

    // Create a download link
    const url = `${base}/api/export/zip?${params.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.click();
  },
};

export default apiClient;
