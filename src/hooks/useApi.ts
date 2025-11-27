'use client';

import { useState, useCallback } from 'react';
import { ApiResponse } from '@/types/models';

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface UseApiReturn<T, P = void> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  execute: (params?: P) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T, P = void>(
  apiCall: (params?: P) => Promise<Response>,
  options?: UseApiOptions<T>
): UseApiReturn<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (params?: P): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiCall(params);
      const result: ApiResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'An error occurred');
      }
      
      setData(result.data || null);
      options?.onSuccess?.(result.data as T);
      return result.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall, options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, execute, reset };
}

// Helper function to build query string
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// Generic fetch functions
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    credentials: 'include', // Include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  // Check content type to ensure we're getting JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // If not JSON, likely an auth redirect or error page
    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Unauthorized. Please log in again.' };
    }
    return { success: false, error: 'Unexpected server response' };
  }

  return response.json();
}

export async function createItem<T, C>(url: string, data: C): Promise<ApiResponse<T>> {
  return fetchApi<T>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateItem<T, U>(url: string, data: U): Promise<ApiResponse<T>> {
  return fetchApi<T>(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteItem(url: string): Promise<ApiResponse<null>> {
  return fetchApi<null>(url, {
    method: 'DELETE',
  });
}

