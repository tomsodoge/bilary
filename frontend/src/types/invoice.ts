export interface User {
  id: number;
  email: string;
  imap_server: string;
  imap_port: number;
  created_at: string;
}

export interface Invoice {
  id: number;
  user_id: number;
  sender_email: string;
  sender_name: string | null;
  subject: string | null;
  received_date: string;
  file_path: string | null;
  file_url: string | null;
  category: string;
  is_private: boolean;
  created_at: string;
}

export interface AccountInfo {
  id: number;
  email: string;
  imap_server: string;
  imap_port: number;
  created_at?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  email?: string;
  message: string;
  accounts?: AccountInfo[];
}

export interface SyncResponse {
  success: boolean;
  invoices_found: number;
  message: string;
}

export interface ExportOptions {
  year: number;
  month?: number;
  type: 'business' | 'private';
}

export interface InvoiceFilters {
  sender?: string;
  category?: string;
  is_private?: boolean;
  start_date?: string;
  end_date?: string;
}

export type Category = 'Digital Service' | 'Physical Product' | 'Online Course' | 'Other';

export const CATEGORIES: Category[] = [
  'Digital Service',
  'Physical Product',
  'Online Course',
  'Other'
];
