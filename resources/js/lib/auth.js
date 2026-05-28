import { apiRequest } from './api';

const SESSION_MARKER_KEY = 'auth_session';

export function getToken() {
    const marker = localStorage.getItem(SESSION_MARKER_KEY);
    return marker === '1' ? 'cookie-session' : null;
}

export function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_) {
        return {};
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
    try {
        const payload = await apiRequest('/auth/me');

        if (payload && payload.status === 'success' && payload.data && payload.data.user) {
            saveAuth(payload.data.user);
            return true;
        }

        clearAuth();
        return false;
    } catch (e) {
        clearAuth();
        return false;
    }
}
