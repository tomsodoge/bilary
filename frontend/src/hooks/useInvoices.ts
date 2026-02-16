import { useState, useEffect, useRef } from 'react';
import { invoicesAPI } from '../api/client';
import type { Invoice, InvoiceFilters } from '../types/invoice';

export const useInvoices = (initialFilters?: InvoiceFilters) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default to last 30 days if no filters provided
  const defaultFilters: InvoiceFilters = initialFilters || {
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
  
  const [filters, setFilters] = useState<InvoiceFilters>(defaultFilters);
  const isMounted = useRef(true);
  const hasFetchedInitial = useRef(false);

  const fetchInvoices = async () => {
    if (!isMounted.current) return;
    try {
      setLoading(true);
      setError(null);
      const data = await invoicesAPI.list(filters);
      if (isMounted.current) {
        setInvoices(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const syncInvoices = async (options?: { daysBack?: number; year?: number; includeAll?: boolean }) => {
    try {
      setError(null);
      const result = await invoicesAPI.sync(options);
      await fetchInvoices(); // Refresh list
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync';
      setError(errorMessage);
      throw err;
    }
  };

  const updateInvoice = async (
    id: number,
    data: { category?: string; is_private?: boolean }
  ) => {
    try {
      setError(null);
      const updated = await invoicesAPI.update(id, data);
      
      // Update local state
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? updated : inv))
      );
      
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteInvoice = async (id: number) => {
    try {
      setError(null);
      await invoicesAPI.delete(id);
      
      // Update local state
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete';
      setError(errorMessage);
      throw err;
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    // Only fetch on initial mount
    if (!hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      fetchInvoices();
    }
    
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Separate effect for filter changes
  useEffect(() => {
    // Skip initial mount
    if (hasFetchedInitial.current) {
      fetchInvoices();
    }
  }, [filters.sender, filters.category, filters.is_private, filters.start_date, filters.end_date]);

  return {
    invoices,
    loading,
    error,
    filters,
    setFilters,
    syncInvoices,
    updateInvoice,
    deleteInvoice,
    refetch: fetchInvoices,
  };
};
