import { useState, useEffect } from 'react';
import { authAPI } from '../api/client';
import type { ConnectionStatus } from '../types/invoice';

export const useAuth = () => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await authAPI.getStatus();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setStatus({ connected: false, message: 'Error checking status' });
    } finally {
      setLoading(false);
    }
  };

  const connect = async (email: string, password: string, imapServer?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authAPI.connect(email, password, imapServer);
      setStatus(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = async (userId: number) => {
    try {
      setError(null);
      await authAPI.removeAccount(userId);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove account');
      throw err;
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return {
    status,
    loading,
    error,
    connect,
    checkStatus,
    removeAccount,
    accounts: status?.accounts ?? [],
    isConnected: status?.connected || false,
  };
};
