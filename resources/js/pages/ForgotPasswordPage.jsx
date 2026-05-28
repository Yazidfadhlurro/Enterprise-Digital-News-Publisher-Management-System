import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { getToken, getUser } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useErrorNotification, useNotify } from '../lib/notify';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const notify = useNotify();
    const { t } = useI18n();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState(searchParams.get('email') || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useErrorNotification(error, setError);

    useEffect(() => {
        const token = getToken();
        const user = getUser();

        if (!token) {
            return;
        }

        if (user?.auth_scope === 'internal') {
            navigate('/internal/login', { replace: true });
        } else {
            navigate('/welcome', { replace: true });
        }
    }, [navigate]);

    async function onSubmit(event) {
        event.preventDefault();
        setError('');
        setLoading(true);
        setSuccess('');

        try {
            const payload = await apiRequest('/public/auth/forgot-password', {
                method: 'POST',
                body: { email },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('forgotPassword.errorDefault', 'Gagal mengirim tautan reset.'));
            }

            const message = payload?.message || t('forgotPassword.success', 'Jika email terdaftar, tautan reset sudah dikirim.');
            setSuccess(message);
            notify.success(message);

            setTimeout(() => {
                navigate(searchParams.get('scope') === 'internal' ? '/internal/login' : '/');
            }, 1800);
        } catch (err) {
            setError(err.message || t('forgotPassword.errorDefault', 'Terjadi kesalahan saat mengirim tautan reset.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10 flex items-center justify-center">
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
                <div className="hidden lg:flex items-center justify-center p-12 text-white" style={{ backgroundImage: 'linear-gradient(145deg, rgba(30,64,175,0.96), rgba(15,23,42,0.98)), url(/assets/images/left-login.svg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className="max-w-md text-center">
                        <p className="text-xs uppercase tracking-[0.24em] text-white/70">Portal Berita</p>
                        <h1 className="mt-4 text-4xl font-semibold leading-tight">Lupa kata sandi? Kami bantu pulihkan akses akun Anda.</h1>
                        <p className="mt-4 text-base leading-7 text-white/80">Masukkan email akun Anda. Jika terdaftar, sistem akan mengirim tautan reset yang aman dan sementara.</p>
                    </div>
                </div>

                <div className="p-6 sm:p-10 lg:p-12">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-lg font-semibold text-white">P</div>
                        <div>
                            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Portal Berita</p>
                            <h2 className="text-2xl font-semibold text-slate-900">Atur Ulang Kata Sandi</h2>
                        </div>
                    </div>

                    <p className="mb-6 text-sm leading-6 text-slate-600">
                        {t('forgotPassword.subtitle', 'Masukkan email akun Anda untuk menerima tautan reset kata sandi.')}
                    </p>

                    {success ? (
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {success}
                        </div>
                    ) : null}

                    <form className="space-y-4" onSubmit={onSubmit}>
                        <div>
                            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">{t('forgotPassword.email', 'Email')}</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                                placeholder={t('forgotPassword.emailPlaceholder', 'nama@perusahaan.com')}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(37,99,235,0.25)] transition hover:bg-blue-800 disabled:opacity-50"
                        >
                            {loading ? t('common.processing', 'Memproses...') : t('forgotPassword.submit', 'Kirim Tautan Reset')}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-between text-sm">
                        <Link to={searchParams.get('scope') === 'internal' ? '/internal/login' : '/'} className="font-medium text-blue-700 hover:underline">
                            {t('forgotPassword.backToLogin', 'Kembali ke login')}
                        </Link>
                        <Link to="/register" className="font-medium text-slate-500 hover:text-slate-700 hover:underline">
                            {t('forgotPassword.registerLink', 'Buat akun baru')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
