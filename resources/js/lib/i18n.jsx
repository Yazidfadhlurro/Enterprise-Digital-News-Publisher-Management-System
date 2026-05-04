import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

const I18nContext = createContext(null);

function interpolate(template, params) {
    const base = String(template ?? '');

    if (!params || typeof params !== 'object') {
        return base;
    }

    return base.replace(/\{\s*([^{}\s]+)\s*\}/g, (match, rawKey) => {
        const key = String(rawKey || '').trim();
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            return match;
        }

        const value = params[key];
        return value === null || value === undefined ? '' : String(value);
    });
}

export function I18nProvider({ children }) {
    const intlLocale = 'id-ID';

    const t = useCallback((key, fallback = '', params = null) => {
        const normalizedKey = String(key || '').trim();
        const baseText = String(fallback || normalizedKey || '');
        return interpolate(baseText, params);
    }, []);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = intlLocale;
            document.documentElement.dir = 'ltr';
        }
    }, [intlLocale]);

    const contextValue = useMemo(() => ({
        t,
        intlLocale,
    }), [intlLocale, t]);

    return (
        <I18nContext.Provider value={contextValue}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);

    if (!context) {
        throw new Error('useI18n must be used within I18nProvider.');
    }

    return context;
}
