import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { getToken } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useErrorNotification } from '../lib/notify';

const defaultSummary = {
    total: 0,
    draft_total: 0,
    review_total: 0,
    revision_total: 0,
    published_total: 0,
};

const defaultPagination = {
    total: 0,
    current_page: 1,
    last_page: 1,
};

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

function stageBadgeClass(stage) {
    const map = {
        draft: 'bg-violet-100 text-violet-700',
        review: 'bg-amber-100 text-amber-700',
        revision: 'bg-rose-100 text-rose-700',
        published: 'bg-emerald-100 text-emerald-700',
    };

    return map[stage] || 'bg-slate-100 text-slate-700';
}

function stageIconClass(stage) {
    const map = {
        draft: 'bg-violet-100 text-violet-600',
        review: 'bg-amber-100 text-amber-600',
        revision: 'bg-rose-100 text-rose-600',
        published: 'bg-emerald-100 text-emerald-600',
    };

    return map[stage] || 'bg-slate-100 text-slate-600';
}

function StageIcon({ stage }) {
    if (stage === 'published') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M6.75 3.75h7.5l3 3V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25z" />
                <path d="m8.75 13 2.25 2.25L15.25 11" />
            </svg>
        );
    }

    if (stage === 'revision') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M6.75 3.75h7.5l3 3V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25z" />
                <path d="M14.25 3.75v3h3" />
                <path d="M8.75 15h6.5" />
                <path d="M11 12.75 8.75 15 11 17.25" />
            </svg>
        );
    }

    if (stage === 'review') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M6 4.5h8.5l3.5 3.5V19.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 6 4.5z" />
                <path d="M14.5 4.5V8h3.5" />
                <path d="M8 11h8" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <path d="M6.75 3.75h7.5l3 3V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25z" />
            <path d="M14.25 3.75v3h3" />
            <path d="M9 13.5h6" />
            <path d="M12 10.5v6" />
        </svg>
    );
}

export default function EditorialActivityLogPage({
    Shell,
    title,
    endpoint,
    buildDetailPath,
    quickActionLabel = 'Lihat Detail',
}) {
    const navigate = useNavigate();
    const { t, intlLocale } = useI18n();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [stage, setStage] = useState('all');
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activities, setActivities] = useState([]);
    const [summary, setSummary] = useState(defaultSummary);
    const [pagination, setPagination] = useState(defaultPagination);

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
                stage,
                per_page: '10',
            });

            const payload = await apiRequest(`${endpoint}?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('activity.errorLoad', 'Gagal memuat log aktivitas editorial.'));
            }

            setActivities(payload?.data?.activities || []);
            setSummary(payload?.data?.summary || defaultSummary);
            setPagination(payload?.data?.pagination || defaultPagination);
        } catch (err) {
            setError(err.message || t('activity.errorLoad', 'Terjadi kesalahan saat memuat aktivitas editorial.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadActivities(page);
    }, [page, search, stage]);

    const subtitle = useMemo(
        () => t('activity.subtitle', '{count} aktivitas editorial tercatat', { count: summary.total || 0 }),
        [summary.total, t]
    );
    const actionLabel = loading
        ? t('activity.refreshing', 'Memuat...')
        : t('activity.refresh', 'Refresh');
    const resolvedQuickActionLabel = quickActionLabel || t('activity.quickAction', 'Lihat Detail');

    return (
        <Shell
            title={title}
            subtitle={subtitle}
            action={(
                <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    onClick={() => loadActivities(page)}
                    disabled={loading}
                >
                    {actionLabel}
                </button>
            )}
        >
            <section className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('activity.total', 'Total Aktivitas')}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('activity.draft', 'Draft')}</p>
                    <p className="mt-2 text-2xl font-semibold text-violet-700">{summary.draft_total || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('activity.review', 'Review')}</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-700">{summary.review_total || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('activity.revision', 'Revisi')}</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-700">{summary.revision_total || 0}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('activity.published', 'Publikasi')}</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700">{summary.published_total || 0}</p>
                </article>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t('activity.searchPlaceholder', 'Cari aktivitas, user, atau judul berita...')}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    />

                    <select
                        value={stage}
                        onChange={(event) => {
                            setPage(1);
                            setStage(event.target.value);
                        }}
                        className="w-full md:w-52 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="all">{t('activity.stage.all', 'Semua Tahap')}</option>
                        <option value="draft">{t('activity.stage.draft', 'Draft')}</option>
                        <option value="review">{t('activity.stage.review', 'Review')}</option>
                        <option value="revision">{t('activity.stage.revision', 'Revisi')}</option>
                        <option value="published">{t('activity.stage.published', 'Publikasi')}</option>
                    </select>
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-3">{t('activity.table.activity', 'Aktivitas')}</th>
                                <th className="py-2.5 px-3">{t('activity.table.user', 'User')}</th>
                                <th className="py-2.5 px-3">{t('activity.table.stage', 'Tahap')}</th>
                                <th className="py-2.5 px-3">{t('activity.table.time', 'Waktu')}</th>
                                <th className="py-2.5 px-3">{t('activity.table.action', 'Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">{t('activity.loading', 'Memuat data...')}</td>
                                </tr>
                            ) : activities.length ? (
                                activities.map((activity) => (
                                    <tr key={activity.id}>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${stageIconClass(activity.stage)}`}>
                                                    <StageIcon stage={activity.stage} />
                                                </div>
                                                <div className="leading-5">
                                                    <p className="text-slate-800 font-medium">{activity.message}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{activity.target || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-slate-600">{activity.actor_name}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stageBadgeClass(activity.stage)}`}>
                                                {activity.stage_label || 'Workflow'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <p className="text-slate-700">{activity.time}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(activity.happened_at, intlLocale)}</p>
                                        </td>
                                        <td className="py-3 px-3">
                                            {typeof buildDetailPath === 'function' && buildDetailPath(activity) ? (
                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                    onClick={() => navigate(buildDetailPath(activity))}
                                                >
                                                    {resolvedQuickActionLabel}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">{t('activity.empty', 'Belum ada log aktivitas editorial.')}</td>
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
                        {t('activity.pagination.prev', 'Sebelumnya')}
                    </button>

                    <span className="px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white">
                        {pagination.current_page || 1}
                    </span>

                    <button
                        type="button"
                        disabled={pagination.current_page >= pagination.last_page}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setPage((prev) => Math.min(pagination.last_page || 1, prev + 1))}
                    >
                        {t('activity.pagination.next', 'Berikutnya')}
                    </button>
                </div>
            </section>
        </Shell>
    );
}
