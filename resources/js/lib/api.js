let csrfCookiePromise = null;

function getCookieValue(name) {
    if (typeof document === 'undefined') return null;

    const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
    return match ? match[1] : null;
}

function getXsrfToken() {
    const rawValue = getCookieValue('XSRF-TOKEN');
    if (!rawValue) return null;

    try {
        return decodeURIComponent(rawValue);
    } catch (_) {
        return rawValue;
    }
}

async function ensureCsrfCookie() {
    if (!getXsrfToken()) {
        csrfCookiePromise = null;
    }

    if (!csrfCookiePromise) {
        csrfCookiePromise = (async () => {
            async function doFetch() {
                const response = await fetch('/sanctum/csrf-cookie', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                });
                // Don't throw on non-ok — cookie may still be set
                return response;
            }

            await doFetch();

            // Retry once if cookie still not present
            if (!getXsrfToken()) {
                await doFetch();
            }

            // If still no cookie, continue anyway — NormalizeCsrfToken middleware
            // on the server will read the XSRF-TOKEN cookie directly from the request.
            return true;
        })().catch((error) => {
            csrfCookiePromise = null;
            throw error;
        });
    }

    return csrfCookiePromise;
}

async function sendApiRequest(path, method, finalHeaders, payloadBody, responseType) {
    const response = await fetch(`/api${path}`, {
        method,
        headers: finalHeaders,
        body: payloadBody,
        credentials: 'include',
    });

    if (responseType === 'blob') {
        if (!response.ok) {
            let errorMessage = 'Terjadi kesalahan pada server.';
            try {
                const errorPayload = await response.json();
                errorMessage = errorPayload?.message || errorMessage;
            } catch (_) {
            }

            throw new Error(errorMessage);
        }

        return response.blob();
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }

    return { response, payload };
}

export async function apiRequest(path, options = {}) {
    const {
        method = 'GET',
        body,
        token,
        headers = {},
        responseType = 'json',
    } = options;

    const normalizedMethod = String(method || 'GET').toUpperCase();
    const requiresCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod);

    const finalHeaders = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...headers,
    };

    void token;

    if (requiresCsrf) {
        await ensureCsrfCookie();
        const xsrfToken = getXsrfToken();
        if (xsrfToken) {
            finalHeaders['X-XSRF-TOKEN'] = xsrfToken;
            finalHeaders['X-CSRF-TOKEN'] = xsrfToken;
        }
    }

    let payloadBody;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    if (body !== undefined) {
        if (isFormData) {
            payloadBody = body;
        } else {
            // Legacy auth endpoints expect form-encoded payloads.
            // Only apply to the legacy /auth/* routes, NOT the scoped
            // /public/auth/* or /internal/auth/* routes which accept JSON.
            const isAuthLogin = /^\/auth\/(login|register)/i.test(String(path));

            if (isAuthLogin) {
                finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
                payloadBody = new URLSearchParams(body).toString();
            } else {
                finalHeaders['Content-Type'] = 'application/json';
                payloadBody = JSON.stringify(body);
            }
        }
    }

    let { response, payload } = await sendApiRequest(path, normalizedMethod, finalHeaders, payloadBody, responseType);

    if (response.status === 419 && requiresCsrf) {
        csrfCookiePromise = null;
        await ensureCsrfCookie();

        const retryHeaders = {
            ...finalHeaders,
        };

        const xsrfToken = getXsrfToken();
        if (xsrfToken) {
            retryHeaders['X-XSRF-TOKEN'] = xsrfToken;
            retryHeaders['X-CSRF-TOKEN'] = xsrfToken;
        }

        ({ response, payload } = await sendApiRequest(path, normalizedMethod, retryHeaders, payloadBody, responseType));
    }

    if (!response.ok) {
        const message = payload?.message || 'Terjadi kesalahan pada server.';
        throw new Error(message);
    }

    return payload;
}
