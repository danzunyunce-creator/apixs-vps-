export const BASE_URL = ''; // Proxied via Vite
export const TOKEN_KEY = 'apixs-ses-id'; // Canonical token storage key — must match App.tsx handleLogin
let apiCache: Record<string, { data: any, timestamp: number, ttl: number }> = {};

export const apiFetch = async (endpoint: string, options: any = {}) => {
    // Read token from both storages (remember-me uses localStorage, session uses sessionStorage)
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    
    // --- Performance Optimization: Selective Caching ---
    const useCache = options.method === 'GET' || !options.method;
    const cacheTTL = options.cacheTTL || 300000; // Default 5 minutes
    const skipCache = options.skipCache || false;

    if (useCache && !skipCache && apiCache[endpoint]) {
        const entry = apiCache[endpoint];
        if (Date.now() - entry.timestamp < entry.ttl) {
            console.log(`⚡ [API Cache] Hit: ${endpoint}`);
            return entry.data;
        }
    }

    const headers = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers 
    };

    const response = await fetch(endpoint, { ...options, headers });
    
    if (!response.ok) {
        if (response.status === 401) {
            // Clear all auth state without hard redirect (let React handle it)
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('apixs_auth');
            sessionStorage.removeItem('apixs_auth');
            // Use hash navigation instead of hard redirect to preserve React state
            window.location.hash = '';
            window.location.reload();
        }
        const err = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(err.error || 'Request failed');
    }

    const data = await response.json();

    // Cache the result if applicable
    if (useCache && !skipCache) {
        apiCache[endpoint] = { data, timestamp: Date.now(), ttl: cacheTTL };
    }

    return data;
};

export const clearApiCache = (endpoint?: string) => {
    if (endpoint) delete apiCache[endpoint];
    else apiCache = {};
};
