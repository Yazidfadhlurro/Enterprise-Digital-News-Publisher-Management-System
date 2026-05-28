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
                    // use include to be resilient across dev setups and ports
                    credentials: 'include',
                    headers: {
                        Accept: 'application/json',
                    },
                    cache: 'no-store',
                });

                if (!response.ok) {
                    throw new Error('Gagal memuat CSRF cookie.');
                }

                return response;
            }

            // first attempt
            await doFetch();

            // ensure the cookie is actually present (some environments require include/retry)
            if (!getXsrfToken()) {
                // retry once
                await doFetch();
                if (!getXsrfToken()) {
                    throw new Error('Gagal memuat CSRF cookie; periksa konfigurasi cookie/domain (SANCTUM_STATEFUL_DOMAINS, SESSION_DOMAIN).');
                }
            }

            return true;
        })().catch((error) => {
            csrfCookiePromise = null;
            throw error;
        });
    }

    await csrfCookiePromise;

    if (!getXsrfToken()) {
        csrfCookiePromise = null;
        return ensureCsrfCookie();
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
            // Some legacy auth endpoints in this project expect form-encoded
            // payloads. Detect login routes and send URL-encoded body to
            // avoid server-side JSON parsing edge-cases.
            const isAuthLogin = /auth\/(login|register)/i.test(String(path));

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
