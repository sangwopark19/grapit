import { useAuthStore } from '@/stores/use-auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiError {
  message: string;
  statusCode: number;
}

class ApiClientError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as { accessToken: string };
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  let res = await fetch(`${API_URL}${path}`, config);

  // On 401, attempt silent refresh and retry once
  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Update store with new token
      const { user } = useAuthStore.getState();
      if (user) {
        useAuthStore.getState().setAuth(newToken, user);
      }

      // Retry with new token
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, { ...config, headers });
    } else {
      // Refresh failed -- clear auth and redirect
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
      throw new ApiClientError('인증이 만료되었습니다. 다시 로그인해주세요.', 401);
    }
  }

  if (!res.ok) {
    let errorMessage = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    try {
      const errorData = (await res.json()) as ApiError;
      errorMessage = errorData.message || errorMessage;
    } catch {
      // Use default message
    }
    throw new ApiClientError(errorMessage, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { ApiClientError };
