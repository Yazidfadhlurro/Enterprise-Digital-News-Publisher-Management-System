import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './i18n';

const NotifyContext = createContext(null);

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function NotificationIcon({ type }) {
    if (type === 'success') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12 2.3 2.3L15.8 9.2" />
            </svg>
        );
    }

    if (type === 'info') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10v6" />
                <path d="M12 7.2h.01" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <circle cx="12" cy="12" r="9" />
            <path d="m9.2 9.2 5.6 5.6" />
            <path d="m14.8 9.2-5.6 5.6" />
        </svg>
    );
}

function toneClass(type) {
    const map = {
        error: 'portal-notify-error',
        success: 'portal-notify-success',
        info: 'portal-notify-info',
    };

    return map[type] || map.error;
}

export function NotificationProvider({ children }) {
    const { t } = useI18n();
    const [notifications, setNotifications] = useState([]);
    const timeoutMapRef = useRef(new Map());

    const dismiss = useCallback((id) => {
        const timer = timeoutMapRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timeoutMapRef.current.delete(id);
        }

        setNotifications((previous) => previous.filter((item) => item.id !== id));
    }, []);

    const push = useCallback((input) => {
        const payload = typeof input === 'string' ? { message: input } : (input || {});
        const message = String(payload.message || '').trim();

        if (!message) {
            return null;
        }

        const type = payload.type || 'error';
        const duration = Math.max(1200, Number(payload.duration) || 3000);
        const id = generateId();

        setNotifications((previous) => {
            const next = [...previous, { id, type, message }];
            return next.slice(-3);
        });

        const timeoutId = setTimeout(() => {
            dismiss(id);
        }, duration);

        timeoutMapRef.current.set(id, timeoutId);
        return id;
    }, [dismiss]);

    useEffect(() => {
        function onWindowNotify(event) {
            push(event?.detail || {});
        }

        window.addEventListener('portal:notify', onWindowNotify);
        return () => {
            window.removeEventListener('portal:notify', onWindowNotify);
        };
    }, [push]);

    useEffect(() => () => {
        timeoutMapRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
        timeoutMapRef.current.clear();
    }, []);

    const api = useMemo(() => ({
        notify: (message, options = {}) => push({ ...options, message }),
        error: (message, options = {}) => push({ ...options, type: 'error', message }),
        success: (message, options = {}) => push({ ...options, type: 'success', message }),
        info: (message, options = {}) => push({ ...options, type: 'info', message }),
        dismiss,
    }), [dismiss, push]);

    return (
        <NotifyContext.Provider value={api}>
            {children}
            <div className="portal-notify-layer" aria-live="assertive" aria-atomic="true">
                <div className="portal-notify-stack">
                    {notifications.map((item) => (
                        <div key={item.id} role="alert" className={`portal-notify-card ${toneClass(item.type)}`}>
                            <div className="portal-notify-icon-wrap">
                                <NotificationIcon type={item.type} />
                            </div>
                            <p className="portal-notify-text">{item.message}</p>
                            <button
                                type="button"
                                className="portal-notify-dismiss"
                                onClick={() => dismiss(item.id)}
                                aria-label={t('notify.close', 'Tutup notifikasi')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                    <path d="M6 6l12 12" />
                                    <path d="M18 6L6 18" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </NotifyContext.Provider>
    );
}

export function useNotify() {
    const context = useContext(NotifyContext);

    if (!context) {
        throw new Error('useNotify must be used within NotificationProvider.');
    }

    return context;
}

export function useErrorNotification(error, clearError) {
    const notify = useNotify();

    useEffect(() => {
        if (!error) {
            return;
        }

        notify.error(error);

        if (typeof clearError === 'function') {
            clearError('');
        }
    }, [clearError, error, notify]);
}

export function notifyGlobal(message, options = {}) {
    window.dispatchEvent(new CustomEvent('portal:notify', {
        detail: {
            ...options,
            message,
        },
    }));
}
