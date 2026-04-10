import useSWR from 'swr';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('nucleus_token');
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`http://localhost:3001${url}`, { headers });
  if (!res.ok) {
     const error = new Error('An error occurred while fetching the data.');
     (error as any).info = await res.json();
     (error as any).status = res.status;
     throw error;
  }
  return res.json();
};

export function useApi(endpoint: string | null) {
  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher);
  return {
    data: data?.data,
    meta: data?.meta,
    error,
    isLoading,
    mutate
  };
}
