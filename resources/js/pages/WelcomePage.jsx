import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { clearAuth, getToken, getUser } from '../lib/auth';
import { useI18n } from '../lib/i18n';

function dynamicKey(prefix, value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return `${prefix}.empty`;
    }

    return `${prefix}.${encodeURIComponent(text).slice(0, 140)}`;
}

export default function WelcomePage() {
    const navigate = useNavigate();
    const user = getUser();
    const { t } = useI18n();

    async function logout() {
        const token = getToken();

        try {
            if (token) {
                await apiRequest('/auth/logout', {
                    method: 'POST',
                    token,
                });
            }
        } catch (_) {
            // Ignore and clear local auth anyway.
        } finally {
            clearAuth();
            navigate('/');
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <h1 className="text-3xl font-bold text-slate-900">{t('welcome.title', 'Selamat Datang')}</h1>
                <p className="mt-2 text-slate-600">
                    {t('welcome.greeting', 'Halo, {name}! Anda sudah berhasil masuk.', {
                        name: t(dynamicKey('welcome.userName', user?.name || 'Pengguna'), user?.name || 'Pengguna'),
                    })}
                </p>
                <p className="mt-1 text-slate-500 text-sm">
                    {t('welcome.currentRole', 'Peran Anda saat ini:')} {' '}
                    <span className="font-semibold">{t(`role.${user?.role || '-'}`, user?.role || '-')}</span>
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    {user?.role === 'admin' ? (
                        <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                            onClick={() => navigate('/admin/dashboard')}
                        >
                            {t('welcome.openAdminDashboard', 'Buka Dashboard Admin')}
                        </button>
                    ) : null}

                    {user?.role === 'reviewer' ? (
                        <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                            onClick={() => navigate('/editor/review')}
                        >
                            {t('welcome.openEditorDashboard', 'Buka Dashboard Editor')}
                        </button>
                    ) : null}

                    {user?.role === 'author' ? (
                        <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                            onClick={() => navigate('/author/dashboard')}
                        >
                            {t('welcome.openAuthorDashboard', 'Buka Dashboard Penulis')}
                        </button>
                    ) : null}

                    {user?.role === 'user' ? (
                        <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                            onClick={() => navigate('/reader/home')}
                        >
                            {t('welcome.openReaderHome', 'Buka Beranda Pembaca')}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-300 transition"
                        onClick={logout}
                    >
                        {t('shell.logout', 'Keluar')}
                    </button>
                </div>
            </div>
        </div>
    );
}
