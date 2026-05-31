import { apiRequest } from './api';

const SESSION_MARKER_KEY = 'auth_session';

export function getToken() {
    const marker = localStorage.getItem(SESSION_MARKER_KEY);
    return marker === '1' ? 'cookie-session' : null;
}

export function getUser() {
    try {
        const parsed = JSON.parse(localStorage.getItem('user') || 'null');
        // Return null if no valid user object (must have at least an id)
        if (!parsed || !parsed.id) return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

export function saveAuth(userOrToken, maybeUser) {
    const user = maybeUser ?? userOrToken;

    localStorage.setItem(SESSION_MARKER_KEY, '1');
    localStorage.removeItem('auth_token');
    localStorage.setItem('user', JSON.stringify(user || {}));
}

export function updateStoredUser(user) {
    const existing = getUser();
    localStorage.setItem('user', JSON.stringify({
        ...existing,
        ...(user || {}),
    }));
}

export function clearAuth() {
    localStorage.removeItem(SESSION_MARKER_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
}

export async function bootstrapSession() {
    // Only attempt to restore session if we have a stored session marker
    const marker = localStorage.getItem(SESSION_MARKER_KEY);
    if (marker !== '1') {
        return false;
    }

    try {
        const payload = await apiRequest('/auth/me');

        if (payload && payload.status === 'success' && payload.data && payload.data.user) {
            saveAuth(payload.data.user);
            return true;
        }

        // Session expired or invalid — clear auth state
        clearAuth();
        return false;
    } catch (e) {
        // On 401 (session expired), clear auth so user is redirected to login
        if (e?.message && (e.message.includes('401') || e.message.includes('Unauthenticated') || e.message.includes('Silakan login'))) {
            clearAuth();
        }
        // For network errors, keep existing auth state so offline users aren't logged out
        return false;
    }
}
