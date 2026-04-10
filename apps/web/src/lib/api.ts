export const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
};

export const fetchClient = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${getApiUrl()}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer dummy-token-for-dev');
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
};
