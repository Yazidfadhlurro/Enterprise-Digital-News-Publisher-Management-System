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
const uiModeStorageKey = 'internal_ui_mode';

function buildUiModeMeta(t) {
    return {
        normal: { label: t('mode.normal', 'Mode Terang'), Icon: ModeNormalIcon },
        night: { label: t('mode.night', 'Mode Gelap'), Icon: ModeNightIcon },
        read: { label: t('mode.read', 'Mode Baca'), Icon: ModeReadIcon },
    };
}

export default function InternalLoginPage() {
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

    useEffect(() => {
        const token = getToken();
        const user = getUser();

        if (!token) {
            return;
        }

        if (user?.auth_scope === 'public') {
            navigate('/', { replace: true });
            return;
        }

        if (user?.auth_scope === 'internal') {
            navigate(resolveLandingPath(user?.role), { replace: true });
        }
    }, [navigate]);

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

    function resolveLandingPath(role) {
        if (role === 'admin') {
            return '/admin/dashboard';
        }

        if (role === 'reviewer') {
            return '/editor/review';
        }

        if (role === 'author') {
            return '/author/dashboard';
        }

        return '/welcome';
    }

    async function onSubmit(event) {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = await apiRequest('/internal/auth/login', {
                method: 'POST',
                body: { email, password },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || 'Login internal gagal.');
            }

            const user = payload?.data?.user;

            if (user?.auth_scope !== 'internal') {
                throw new Error(t('internalLogin.errorPublicAccount', 'Akun Anda adalah akun publik. Gunakan login publik untuk masuk.'));
            }

            saveAuth(user);
            navigate(resolveLandingPath(user?.role), { replace: true });
        } catch (err) {
            setError(err.message || t('login.errorDefault', 'Terjadi kesalahan saat login.'));
        } finally {
            setLoading(false);
        }
    }

    const heroOverlayByMode = {
        normal: 'linear-gradient(138deg, rgba(15, 40, 92, 0.9) 0%, rgba(13, 17, 23, 0.92) 100%)',
        night: 'linear-gradient(138deg, rgba(10, 24, 56, 0.92) 0%, rgba(4, 8, 20, 0.96) 100%)',
        read: 'linear-gradient(138deg, rgba(101, 74, 39, 0.86) 0%, rgba(48, 34, 21, 0.9) 100%)',
    };

    useEffect(() => {
        try {
            localStorage.setItem(uiModeStorageKey, uiMode);
        } catch (_) {
        }
    }, [uiMode]);
    return (
        <div
            className={`auth-page auth-mode-${uiMode} w-full min-h-screen flex`}
            style={{ fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
        >
            <div
                className="auth-hero hidden lg:flex w-3/5 items-center justify-center p-12"
                style={{
                    backgroundImage: `${heroOverlayByMode[uiMode] || heroOverlayByMode.normal}, url('/assets/images/left-login.svg')`,
                    backgroundSize: 'cover, cover',
                    backgroundPosition: 'center, center',
                    backgroundRepeat: 'no-repeat, no-repeat',
                }}
            >
                <div className="max-w-[800px] text-white text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="flex w-11 h-11 items-center justify-center bg-blue-700 rounded-xl shadow-sm">
                            <span className="text-white font-semibold text-lg tracking-tight">P</span>
                        </div>
                        <span className="auth-brand text-slate-900 font-semibold text-[0.98rem] tracking-[0.2em] uppercase">PORTAL INTERNAL</span>
                    </div>

                    <h1 className="text-[2.55rem] xl:text-[2.95rem] font-semibold tracking-[-0.045em] leading-[1.04]">{t('internalLogin.heroTitle', 'Kolaborasi Redaksi dalam Satu Platform')}</h1>
                    <p className="mt-5 text-[1.04rem] xl:text-[1.1rem] text-white/82 leading-8 font-normal max-w-[60ch] mx-auto">{t('internalLogin.heroSubtitle', 'Kelola artikel, proses review, dan publikasi konten dengan workflow internal yang lebih cepat, aman, dan terorganisir.')}</p>
                    <p className="mt-4 text-[0.95rem] text-white/72 font-normal leading-7 max-w-[64ch] mx-auto">{t('internalLogin.heroMini', 'Digunakan oleh tim admin, author, dan reviewer perusahaan.')}</p>
                    <blockquote className="mt-8 text-[0.95rem] italic text-white/62 leading-7">"{t('internalLogin.heroQuote', 'Menulis bersama, maju bersama.') }"</blockquote>
                </div>
            </div>

            <div className="auth-panel relative w-full lg:w-2/5 flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16 bg-slate-50/70">
                <button
                    type="button"
                    onClick={cycleUiMode}
                    className="auth-mode-toggle absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-xl border bg-white/90 shadow-sm transition flex items-center justify-center"
                    title={currentMode.label}
                    aria-label={currentMode.label}
                >
                    <CurrentModeIcon className="w-4 h-4" />
                </button>

                <form className="auth-form w-full max-w-[460px]" onSubmit={onSubmit}>
                    <div className="mb-8 text-center">
                        <h2 className="auth-title text-center text-[1.88rem] sm:text-[2.05rem] font-semibold tracking-[-0.045em] text-slate-900 mb-3 leading-tight">{t('internalLogin.title', 'Selamat Datang Kembali')}</h2>
                        <p className="auth-subtitle text-center text-slate-500 text-[0.98rem] leading-7 max-w-[34ch] mx-auto">{t('internalLogin.subtitle', 'Kelola artikel, review, dan publikasi dalam satu sistem terintegrasi.')}</p>
                    </div>

                    <div className="mb-5">
                        <label htmlFor="email" className="auth-field-label block text-slate-700 font-medium text-[0.88rem] mb-2 tracking-[0.12em] uppercase">{t('login.email', 'Email')}</label>
                        <input
                            className="auth-input w-full h-12 px-4 py-3 bg-white border border-slate-200 rounded-xl text-[0.98rem] text-slate-900 placeholder-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder={t('internalLogin.placeholderEmail', 'nama@perusahaan.com')}
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="password" className="auth-field-label block text-slate-700 font-medium text-[0.88rem] mb-2 tracking-[0.12em] uppercase">{t('login.password', 'Kata Sandi')}</label>
                        <input
                            className="auth-input w-full h-12 px-4 py-3 bg-white border border-slate-200 rounded-xl text-[0.98rem] text-slate-900 placeholder-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder={t('internalLogin.placeholderPassword', 'Masukkan kata sandi Anda')}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="auth-submit-btn w-full h-12 flex items-center justify-center bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 active:from-blue-900 active:to-blue-800 disabled:opacity-50 rounded-xl shadow-[0_10px_24px_rgba(37,99,235,0.22)] transition-colors focus:outline-none"
                    >
                        <span className="text-white font-medium text-[0.95rem] tracking-[0.06em]">{loading ? t('login.processing', 'Memproses...') : t('internalLogin.submit', 'Masuk Sekarang')}</span>
                    </button>

                    <div className="flex items-center justify-center mt-5">
                        <p className="auth-subtitle text-slate-600 text-[0.93rem] leading-6">
                            {t('internalLogin.publicHint', 'Ingin membaca berita publik?')}{' '}
                            <Link to="/" className="text-blue-700 font-semibold hover:underline">{t('internalLogin.publicLink', 'Buka portal utama')}</Link>
                        </p>
                    </div>

                    <div className="flex items-center justify-center mt-3">
                        <Link to="/forgot-password?scope=internal" className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline">
                            {t('login.forgotPassword', 'Lupa kata sandi?')}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
