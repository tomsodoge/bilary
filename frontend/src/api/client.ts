import axios from 'axios';
import type {
  ConnectionStatus,
  Invoice,
  SyncResponse,
  InvoiceFilters,
  ExportOptions,
  AccountInfo
} from '../types/invoice';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for error handling
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
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
    const response = await apiClient.get<ConnectionStatus>('/api/auth/status');
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

// Invoices API
export const invoicesAPI = {
  sync: async (options?: { daysBack?: number; year?: number; includeAll?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.daysBack) params.append('days_back', String(options.daysBack));
    if (options?.year) params.append('year', String(options.year));
    if (options?.includeAll) params.append('include_all', 'true');
    
    const response = await apiClient.post<SyncResponse>(
      `/api/invoices/sync?${params.toString()}`
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
    const params = new URLSearchParams({
      year: String(options.year),
      type: options.type,
    });
    
    if (options.month) {
      params.append('month', String(options.month));
    }

    // Create a download link
    const url = `${API_BASE_URL}/api/export/zip?${params.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.click();
  },
};

export default apiClient;
