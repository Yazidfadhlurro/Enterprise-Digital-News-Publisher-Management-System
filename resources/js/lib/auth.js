export function getToken() {
    return localStorage.getItem('auth_token');
}

export function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_) {
        return {};
    }
}

export function saveAuth(token, user) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

export function updateStoredUser(user) {
    const existing = getUser();
    localStorage.setItem('user', JSON.stringify({
        ...existing,
        ...(user || {}),
    }));
}

export function clearAuth() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
}
