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

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = getAuthToken();
    
    // Ensure endpoint is full URL if BASE_URL exists
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    
    // Merge headers
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as any) || {}),
    };

    // Remove Content-Type if body is FormData (to let browser set boundary)
    if (options.body instanceof FormData) {
        delete (headers as any)['Content-Type'];
    }

    try {
        const response = await fetch(fullUrl, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            console.warn('[API] Unauthorized access detected, logging out...');
            clearAuth();
            throw new Error('Sesi berakhir. Silakan login kembali.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // Check if it's a file download (backup)
        const contentType = response.headers.get('content-type');
        if (contentType && (contentType.includes('application/octet-stream') || contentType.includes('application/x-sqlite3'))) {
            return response.blob();
        }

        return await response.json();
    } catch (error: any) {
        console.error(`[API Error] ${endpoint}:`, error);
        throw error;
    }
}
