import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { getToken, getUser } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useErrorNotification, useNotify } from '../lib/notify';

function MailIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M4.5 7.5h15a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15V9a1.5 1.5 0 0 1 1.5-1.5z" />
            <path d="m5 9 7 5 7-5" />
        </svg>
    );
}

export default function VerifyEmailPage() {
    const navigate = useNavigate();
    const notify = useNotify();
    const { t } = useI18n();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState(searchParams.get('email') || '');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useErrorNotification(error, setError);

    const heroBg = useMemo(() => (
        'linear-gradient(145deg, rgba(30,64,175,0.96), rgba(15,23,42,0.98)), url(/assets/images/left-login.svg)'
    ), []);

    useEffect(() => {
        const token = getToken();
        const user = getUser();

        if (!token) {
            return;
        }

        if (user?.auth_scope === 'internal') {
            navigate('/internal/login', { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        const initialEmail = searchParams.get('email');

        if (initialEmail) {
            setEmail(initialEmail);
        }
    }, [searchParams]);

    async function onSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const payload = await apiRequest('/public/auth/verify-email', {
                method: 'POST',
                body: { email, code },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('verifyEmail.errorDefault', 'Verifikasi gagal.'));
            }

            const message = payload?.message || t('verifyEmail.success', 'Email berhasil diverifikasi. Silakan masuk.');
            setSuccess(message);
            notify.success(message);

            setTimeout(() => {
                navigate('/', { replace: true });
            }, 1600);
        } catch (err) {
            setError(err.message || t('verifyEmail.errorDefault', 'Terjadi kesalahan saat verifikasi.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10 flex items-center justify-center">
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
                <div className="hidden lg:flex items-center justify-center p-12 text-white" style={{ backgroundImage: heroBg, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className="max-w-md text-center">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/70">Portal Berita</p>
                        <h1 className="mt-4 text-4xl font-semibold leading-tight">Masukkan kode aktivasi dari email Anda untuk mengaktifkan akun.</h1>
                        <p className="mt-4 text-base leading-7 text-white/80">Kode verifikasi dikirim setelah registrasi. Halaman ini adalah tempat untuk memasukkannya.</p>
                    </div>
                </div>

                <div className="p-6 sm:p-10 lg:p-12">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-lg font-semibold text-white">
                            <MailIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Portal Berita</p>
                            <h2 className="text-2xl font-semibold text-slate-900">Verifikasi Email</h2>
                        </div>
                    </div>

                    <p className="mb-6 text-sm leading-6 text-slate-600">
                        {t('verifyEmail.subtitle', 'Masukkan email dan kode verifikasi yang dikirim ke inbox Anda.')}
                    </p>

                    {success ? (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {success}
                        </div>
                    ) : null}

                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div>
                            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">{t('verifyEmail.email', 'Email')}</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                                placeholder={t('verifyEmail.emailPlaceholder', 'nama@perusahaan.com')}
                            />
                        </div>

                        <div>
                            <label htmlFor="code" className="mb-2 block text-sm font-medium text-slate-700">{t('verifyEmail.code', 'Kode Verifikasi')}</label>
                            <input
                                id="code"
                                type="text"
                                inputMode="numeric"
                                value={code}
                                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                maxLength={6}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 tracking-[0.5em] shadow-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                                placeholder="123456"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(37,99,235,0.25)] transition hover:bg-blue-800 disabled:opacity-50"
                        >
                            {loading ? t('common.processing', 'Memproses...') : t('verifyEmail.submit', 'Verifikasi Sekarang')}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-between text-sm">
                        <Link to="/register" className="font-medium text-blue-700 hover:underline">
                            {t('verifyEmail.backToRegister', 'Kembali ke daftar')}
                        </Link>
                        <Link to="/" className="font-medium text-slate-500 hover:text-slate-700 hover:underline">
                            {t('verifyEmail.backToLogin', 'Kembali ke login')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}