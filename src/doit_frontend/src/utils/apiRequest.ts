interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: object;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, { method = 'GET', data, signal }: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    credentials: 'include',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || 'Unable to contact the server');
  }
  return response.json();
}
