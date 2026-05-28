import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { getToken, getUser, saveAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useErrorNotification } from '../lib/notify';

function ModeNormalIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M12 4.5a5.25 5.25 0 0 0-3.5 9.17c.66.57 1.06 1.41 1.06 2.3V17.25h5v-1.28c0-.89.4-1.73 1.06-2.3A5.25 5.25 0 0 0 12 4.5z" />
            <path d="M10 19.25h4" />
            <path d="M10.75 21h2.5" />
            <path d="M12 2.5v1.25" />
            <path d="M5.75 6.25l.9.9" />
            <path d="M18.25 6.25l-.9.9" />
        </svg>
    );
}

function ModeNightIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M14.5 3.75A8.25 8.25 0 1 0 20.25 13a6.5 6.5 0 0 1-5.75-9.25z" />
        </svg>
    );
}

function ModeReadIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h4.5A2.25 2.25 0 0 1 13.5 6.75V19.5H6.75A2.25 2.25 0 0 0 4.5 21.75z" />
            <path d="M19.5 6.75A2.25 2.25 0 0 0 17.25 4.5h-4.5A2.25 2.25 0 0 0 10.5 6.75V19.5h6.75a2.25 2.25 0 0 1 2.25 2.25z" />
        </svg>
    );
}

const uiModeOrder = ['normal', 'night', 'read'];
const uiModeStorageKey = 'admin_ui_mode';

function buildUiModeMeta(t) {
    return {
        normal: { label: t('mode.normal', 'Mode Terang'), Icon: ModeNormalIcon },
        night: { label: t('mode.night', 'Mode Gelap'), Icon: ModeNightIcon },
        read: { label: t('mode.read', 'Mode Baca'), Icon: ModeReadIcon },
    };
}

export default function LoginPage() {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [uiMode, setUiMode] = useState(() => {
        try {
            const saved = localStorage.getItem(uiModeStorageKey);
            if (saved === 'normal' || saved === 'night' || saved === 'read') {
                return saved;
            }
        } catch (_) {
        }

        return 'normal';
    });
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const uiModeMeta = useMemo(() => buildUiModeMeta(t), [t]);
    const currentMode = uiModeMeta[uiMode] || uiModeMeta.normal;
    const CurrentModeIcon = currentMode.Icon;

    useErrorNotification(error, setError);

    const heroOverlayByMode = {
        normal: 'linear-gradient(138deg, rgba(26, 86, 219, 0.9) 0%, rgba(13, 17, 23, 0.9) 100%)',
        night: 'linear-gradient(138deg, rgba(15, 40, 92, 0.9) 0%, rgba(6, 10, 22, 0.94) 100%)',
        read: 'linear-gradient(138deg, rgba(121, 88, 44, 0.85) 0%, rgba(58, 40, 24, 0.9) 100%)',
    };

    useEffect(() => {
        const token = getToken();
        const user = getUser();

        if (!token) {
            return;
        }

        if (user?.auth_scope === 'internal') {
            navigate('/internal/login', { replace: true });
            return;
        }

        if (user?.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
        } else if (user?.role === 'reviewer') {
            navigate('/editor/review', { replace: true });
        } else if (user?.role === 'author') {
            navigate('/author/dashboard', { replace: true });
        } else {
            navigate('/reader/home', { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        try {
            localStorage.setItem(uiModeStorageKey, uiMode);
        } catch (_) {
        }
    }, [uiMode]);

    function cycleUiMode() {
        const currentIndex = uiModeOrder.indexOf(uiMode);
        const nextIndex = (currentIndex + 1) % uiModeOrder.length;
        const nextMode = uiModeOrder[nextIndex];

        try {
            localStorage.setItem(uiModeStorageKey, nextMode);
        } catch (_) {
        }

        setUiMode(nextMode);
    }

    async function onSubmit(event) {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = await apiRequest('/public/auth/login', {
                method: 'POST',
                body: { email, password },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || 'Login gagal.');
            }

            const user = payload?.data?.user;

            if (user?.auth_scope !== 'public') {
                throw new Error(t('login.errorInternalAccount', 'Akun Anda adalah akun internal. Gunakan login internal untuk masuk.'));
            }

            saveAuth(user);

            try {
                localStorage.setItem(uiModeStorageKey, uiMode);
            } catch (_) {
            }

            if (user?.role === 'admin') {
                navigate('/admin/dashboard', { replace: true });
            } else if (user?.role === 'reviewer') {
                navigate('/editor/review', { replace: true });
            } else if (user?.role === 'author') {
                navigate('/author/dashboard', { replace: true });
            } else {
                navigate('/reader/home', { replace: true });
            }
        } catch (err) {
            setError(err.message || t('login.errorDefault', 'Terjadi kesalahan saat login.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={`auth-page auth-mode-${uiMode} w-full min-h-screen flex`}>
            <div
                className="auth-hero hidden lg:flex w-1/2 items-center justify-center p-12"
                style={{
                    backgroundImage: `${heroOverlayByMode[uiMode] || heroOverlayByMode.normal}, url('/assets/images/left-login.svg')`,
                    backgroundSize: 'cover, cover',
                    backgroundPosition: 'center, center',
                    backgroundRepeat: 'no-repeat, no-repeat',
                }}
            >
                <div className="max-w-[500px] text-white text-center">
                    <h1 className="text-5xl font-bold leading-tight">{t('login.heroTitle', 'Selamat Datang di PORTAL')}</h1>
                    <p className="mt-4 text-xl text-white/90 leading-8">{t('login.heroSubtitle', 'Sistem portal berita untuk tim redaksi')}</p>
                </div>
            </div>

            <div className="auth-panel relative w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-50">
                <button
                    type="button"
                    onClick={cycleUiMode}
                    className="auth-mode-toggle absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-lg border transition flex items-center justify-center"
                    title={currentMode.label}
                    aria-label={currentMode.label}
                >
                    <CurrentModeIcon className="w-4 h-4" />
                </button>

                <form className="auth-form w-full max-w-[420px]" onSubmit={onSubmit}>
                    <div className="flex items-center justify-center gap-3 mb-12">
                        <div className="flex w-10 h-10 items-center justify-center bg-blue-600 rounded">
                            <span className="text-white font-bold text-lg">P</span>
                        </div>
                        <span className="auth-brand text-slate-900 font-bold text-xl">PORTAL</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="auth-title text-center text-3xl font-bold text-slate-900 mb-2">{t('login.title', 'Masuk ke Akun')}</h2>
                        <p className="auth-subtitle text-center text-slate-500 text-sm">{t('login.subtitle', 'Portal berita yang mudah dipakai')}</p>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="email" className="auth-field-label block text-slate-800 font-medium text-sm mb-1.5">{t('login.email', 'Email')}</label>
                        <input
                            className="auth-input w-full h-11 px-3.5 py-3 bg-white border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="password" className="auth-field-label block text-slate-800 font-medium text-sm mb-1.5">{t('login.password', 'Kata Sandi')}</label>
                        <input
                            className="auth-input w-full h-11 px-3.5 py-3 bg-white border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="auth-submit-btn w-full h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors focus:outline-none"
                    >
                        <span className="text-white font-bold text-sm">{loading ? t('login.processing', 'Memproses...') : t('login.submit', 'Masuk')}</span>
                    </button>

                    <div className="flex items-center justify-center mt-4">
                        <p className="auth-subtitle text-slate-600 text-sm">
                            {t('login.noAccount', 'Belum punya akun?')}{' '}
                            <Link to="/register" className="text-blue-600 font-medium hover:underline">{t('login.registerNow', 'Daftar sekarang')}</Link>
                        </p>
                    </div>

                    <div className="flex items-center justify-center mt-2">
                        <Link to="/forgot-password?scope=public" className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline">
                            {t('login.forgotPassword', 'Lupa kata sandi?')}
                        </Link>
                    </div>

                    <div className="flex items-center justify-center mt-2">
                        <Link to="/verify-email" className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline">
                            {t('login.verifyEmail', 'Sudah daftar? Verifikasi email di sini')}
                        </Link>
                    </div>

                </form>
            </div>
        </div>
    );
}
