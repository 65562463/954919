export async function safeFetch<T>(url: string, options?: RequestInit, timeout = 30000): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  // Ensure headers include Accept: application/json for API calls
  const headers = new Headers(options?.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(id);
    
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      if (!response.ok) {
        console.error(`[API] Error (${response.status}) from ${url}:`, data.error || response.statusText);
        return null;
      }
      return data as T;
    } else {
      // If we expect JSON but get HTML/Text, it's a routing error or Vite fallback
      const text = await response.text();
      console.error(`[API] Expected JSON from ${url} but received ${contentType}. Status: ${response.status}. Body preview: ${text.substring(0, 100)}`);
      return null;
    }
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      console.error(`[API] Request to ${url} timed out after ${timeout}ms`);
    } else {
      console.error(`[API] Fetch Error for ${url}:`, error);
    }
    return null;
  }
}
