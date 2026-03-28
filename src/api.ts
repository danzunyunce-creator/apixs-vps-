/**
 * API Fetch Helper for ApixsLive
 * Handles:
 * 1. Automatic Authorization Header (Bearer Token)
 * 2. Standardized Error Handling
 * 3. 401 Unauthorized handling (automatic logout)
 */

export const getAuthToken = () => {
    return localStorage.getItem('apixs-ses-id') || sessionStorage.getItem('apixs-ses-id') || '';
};

export const clearAuth = () => {
    localStorage.removeItem('apixs_auth');
    localStorage.removeItem('apixs_userData');
    localStorage.removeItem('apixs-ses-id');
    sessionStorage.removeItem('apixs_auth');
    sessionStorage.removeItem('apixs_userData');
    sessionStorage.removeItem('apixs-ses-id');
    window.location.hash = 'login';
    window.location.reload();
};

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const cacheKey = `${endpoint}-${JSON.stringify(options.body || '')}`;

    // Cache lookup for GET requests only
    if (isGet) {
        const cached = apiCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            console.log(`[API Cache] Hit for ${endpoint}`);
            return cached.data;
        }
    }

    const token = getAuthToken();
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as any) || {}),
    };

    if (options.body instanceof FormData) {
        delete (headers as any)['Content-Type'];
    }

    try {
        const response = await fetch(fullUrl, { ...options, headers });

        if (response.status === 401) {
            clearAuth();
            throw new Error('Sesi berakhir.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && (contentType.includes('application/octet-stream') || contentType.includes('application/x-sqlite3'))) {
            return response.blob();
        }

        const result = await response.json();
        
        // Cache storing for GET requests
        if (isGet) {
            apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
        } else {
            // Clear cache for write operations to maintain consistency
            apiCache.clear();
        }

        return result;
    } catch (error: any) {
        console.error(`[API Error] ${endpoint}:`, error);
        throw error;
    }
}
