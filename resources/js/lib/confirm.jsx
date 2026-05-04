import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from './i18n';

const ConfirmContext = createContext(null);

function createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildRequest(message, options, t) {
    return {
        message: String(message || '').trim(),
        title: options?.title || t('common.confirmationTitle', 'Konfirmasi'),
        confirmLabel: options?.confirmLabel || t('common.ok', 'OK'),
        cancelLabel: options?.cancelLabel || t('common.cancel', 'Cancel'),
        tone: options?.tone || 'neutral',
    };
}

export function ConfirmProvider({ children }) {
    const { t } = useI18n();
    const [queue, setQueue] = useState([]);
    const queueRef = useRef([]);
    const confirmButtonRef = useRef(null);

    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const closeTop = useCallback((approved) => {
        setQueue((previous) => {
            if (!previous.length) {
                return previous;
            }

            const [current, ...rest] = previous;
            current.resolve(Boolean(approved));
            return rest;
        });
    }, []);

    const confirm = useCallback((message, options = {}) => {
        const request = buildRequest(message, options, t);

        if (!request.message) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            const id = createId();
            setQueue((previous) => [...previous, { id, ...request, resolve }]);
        });
    }, [t]);

    useEffect(() => () => {
        queueRef.current.forEach((item) => item.resolve(false));
    }, []);

    const active = queue[0] || null;

    useEffect(() => {
        if (!active) {
            return undefined;
        }

        const frame = window.requestAnimationFrame(() => {
            confirmButtonRef.current?.focus();
        });

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeTop(false);
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [active, closeTop]);

    const api = useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmContext.Provider value={api}>
            {children}
            {active ? (
                <div className="portal-confirm-layer" role="presentation">
                    <div className="portal-confirm-backdrop" onClick={() => closeTop(false)} />
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`portal-confirm-title-${active.id}`}
                        aria-describedby={`portal-confirm-message-${active.id}`}
                        className="portal-confirm-card"
                    >
                        <h2 id={`portal-confirm-title-${active.id}`} className="portal-confirm-title">{active.title}</h2>
                        <p id={`portal-confirm-message-${active.id}`} className="portal-confirm-message">{active.message}</p>
                        <div className="portal-confirm-actions">
                            <button
                                type="button"
                                className="portal-confirm-button portal-confirm-button-ok"
                                ref={confirmButtonRef}
                                onClick={() => closeTop(true)}
                            >
                                {active.confirmLabel}
                            </button>
                            <button
                                type="button"
                                className={`portal-confirm-button ${active.tone === 'danger' ? 'portal-confirm-button-danger' : 'portal-confirm-button-cancel'}`}
                                onClick={() => closeTop(false)}
                            >
                                {active.cancelLabel}
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </ConfirmContext.Provider>
    );
}

export function useConfirmDialog() {
    const context = useContext(ConfirmContext);

    if (!context) {
        throw new Error('useConfirmDialog must be used within ConfirmProvider.');
    }

    return context.confirm;
}
