export async function apiRequest(path, options = {}) {
    const {
        method = 'GET',
        body,
        token,
        headers = {},
        responseType = 'json',
    } = options;

    const finalHeaders = {
        Accept: 'application/json',
        ...headers,
    };

    if (token) {
        finalHeaders.Authorization = `Bearer ${token}`;
    }

    let payloadBody;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    if (body !== undefined) {
        if (isFormData) {
            payloadBody = body;
        } else {
            finalHeaders['Content-Type'] = 'application/json';
            payloadBody = JSON.stringify(body);
        }
    }

    const response = await fetch(`/api${path}`, {
        method,
        headers: finalHeaders,
        body: payloadBody,
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

    if (!response.ok) {
        const message = payload?.message || 'Terjadi kesalahan pada server.';
        throw new Error(message);
    }

    return payload;
}
