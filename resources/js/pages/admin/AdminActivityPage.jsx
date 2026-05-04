import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

function formatDateTime(value, localeTag) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString(localeTag || 'id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function typeBadgeClass(type) {
    const map = {
        article: 'admin-activity-type-badge admin-activity-type-article bg-blue-100 text-blue-700',
        user: 'admin-activity-type-badge admin-activity-type-user bg-violet-100 text-violet-700',
    };

    return map[type] || 'admin-activity-type-badge admin-activity-type-default bg-slate-100 text-slate-700';
}

function typeIconClass(type) {
    const map = {
        article: 'admin-activity-type-icon admin-activity-type-icon-article bg-blue-100 text-blue-600',
        user: 'admin-activity-type-icon admin-activity-type-icon-user bg-violet-100 text-violet-600',
    };

    return map[type] || 'admin-activity-type-icon admin-activity-type-icon-default bg-slate-100 text-slate-600';
}

function ActivityIcon({ type }) {
    if (type === 'user') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <circle cx="12" cy="8" r="3" />
                <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <path d="M6.75 3.75h7.5l3 3V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25z" />
            <path d="M14.25 3.75v3h3" />
        </svg>
    );
}

export default function AdminActivityPage() {
    const { t, intlLocale } = useI18n();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [type, setType] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [activities, setActivities] = useState([]);
    const [summary, setSummary] = useState({ total: 0, article_activities: 0, user_activities: 0 });
    const [pagination, setPagination] = useState({ total: 0, current_page: 1, last_page: 1 });

    useErrorNotification(error, setError);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setPage(1);
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    async function loadActivities(nextPage = page) {
        const token = getToken();
        setError('');
        setLoading(true);

        try {
            const params = new URLSearchParams({
                page: String(nextPage),
                q: search,
                type,
                from_date: fromDate,
                to_date: toDate,
                per_page: '10',
            });

            const payload = await apiRequest(`/admin/activities?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.activity.errorLoad', 'Gagal memuat log aktivitas.'));
            }

            setActivities(payload?.data?.activities || []);
            setSummary(payload?.data?.summary || { total: 0, article_activities: 0, user_activities: 0 });
            setPagination(payload?.data?.pagination || { total: 0, current_page: 1, last_page: 1 });
        } catch (err) {
            setError(err.message || t('admin.activity.errorLoadDefault', 'Terjadi kesalahan saat memuat aktivitas.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadActivities(page);
    }, [page, search, type, fromDate, toDate]);

    async function exportCsv() {
        const token = getToken();
        setExporting(true);
        setError('');

        try {
            const params = new URLSearchParams({
                q: search,
                type,
                from_date: fromDate,
                to_date: toDate,
            });

            const blob = await apiRequest(`/admin/activities/export?${params.toString()}`, {
                token,
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `admin-activities-${Date.now()}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message || t('admin.activity.errorExport', 'Gagal mengekspor CSV aktivitas.'));
        } finally {
            setExporting(false);
        }
    }

    const subtitle = useMemo(
        () => t('admin.activity.subtitle', '{count} aktivitas tercatat', { count: summary.total || 0 }),
        [summary.total, t]
    );

    return (
        <AdminShell
            title={t('admin.activity.title', 'Log Aktivitas')}
            subtitle={subtitle}
            action={(
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="portal-btn portal-btn-secondary"
                        onClick={exportCsv}
                        disabled={exporting}
                    >
                        {exporting ? t('common.processing', 'Memproses...') : t('admin.activity.exportCsv', 'Ekspor CSV')}
                    </button>

                    <button
                        type="button"
                        className="portal-btn portal-btn-primary"
                        onClick={() => loadActivities(page)}
                        disabled={loading}
                    >
                        {loading ? t('common.loading', 'Memuat...') : t('common.refresh', 'Muat Ulang')}
                    </button>
                </div>
            )}
        >
            <div className="admin-activity-page">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <article className="admin-page-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.activity.total', 'Total Aktivitas')}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total || 0}</p>
                </article>
                <article className="admin-page-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.activity.articleActivities', 'Aktivitas Artikel')}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.article_activities || 0}</p>
                </article>
                <article className="admin-page-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.activity.userActivities', 'Aktivitas Pengguna')}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.user_activities || 0}</p>
                </article>
            </section>

            <section className="admin-page-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t('admin.activity.searchPlaceholder', 'Cari aktivitas, aktor, atau target...')}
                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    />

                    <select
                        value={type}
                        onChange={(event) => {
                            setPage(1);
                            setType(event.target.value);
                        }}
                        className="admin-page-input w-full md:w-52 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="all">{t('admin.activity.type.all', 'Semua Tipe')}</option>
                        <option value="article">{t('admin.activity.articleActivities', 'Aktivitas Artikel')}</option>
                        <option value="user">{t('admin.activity.userActivities', 'Aktivitas Pengguna')}</option>
                    </select>

                    <input
                        type="date"
                        value={fromDate}
                        onChange={(event) => {
                            setPage(1);
                            setFromDate(event.target.value);
                        }}
                        className="admin-page-input w-full md:w-44 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    />

                    <input
                        type="date"
                        value={toDate}
                        onChange={(event) => {
                            setPage(1);
                            setToDate(event.target.value);
                        }}
                        className="admin-page-input w-full md:w-44 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    />
                </div>
            </section>

            <section className="admin-page-panel rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="admin-page-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-3">{t('admin.activity.table.activity', 'Aktivitas')}</th>
                                <th className="py-2.5 px-3">{t('admin.activity.table.actor', 'Aktor')}</th>
                                <th className="py-2.5 px-3">{t('admin.activity.table.type', 'Tipe')}</th>
                                <th className="py-2.5 px-3">{t('admin.activity.table.time', 'Waktu')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : activities.length ? (
                                activities.map((activity) => (
                                    <tr key={activity.id}>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${typeIconClass(activity.type)}`}>
                                                    <ActivityIcon type={activity.type} />
                                                </div>
                                                <div className="leading-5">
                                                    <p className="text-slate-800 font-medium">{t(`admin.activity.message.${activity.id}`, activity.message || '-')}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{t(`admin.activity.target.${activity.id}`, activity.target || '-')}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-slate-600">{t(`admin.activity.actor.${activity.id}`, activity.actor_name || '-')}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${typeBadgeClass(activity.type)}`}>
                                                {t(`admin.activity.type.${activity.type}`, activity.type_label || activity.type || '-')}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <p className="text-slate-700">{t(`admin.activity.time.${activity.id}`, activity.time || '-')}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(activity.happened_at, intlLocale)}</p>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400">{t('admin.activity.empty', 'Belum ada log aktivitas.')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2 text-sm">
                    <button
                        type="button"
                        disabled={pagination.current_page <= 1}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                        {t('pagination.prev', 'Sebelumnya')}
                    </button>

                    <span className="admin-page-pagination-badge px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white">
                        {pagination.current_page || 1}
                    </span>

                    <button
                        type="button"
                        disabled={pagination.current_page >= pagination.last_page}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setPage((prev) => Math.min(pagination.last_page || 1, prev + 1))}
                    >
                        {t('pagination.next', 'Berikutnya')}
                    </button>
                </div>
            </section>
            </div>
        </AdminShell>
    );
}
