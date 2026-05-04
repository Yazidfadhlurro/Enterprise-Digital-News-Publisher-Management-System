import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { articleStatusBadgeClass, articleStatusLabel } from '../../lib/articleWorkflow';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

const statusColorMap = {
    draft: '#7c3aed',
    pending: '#f59e0b',
    revision: '#ef4444',
    published: '#0ea972',
};

function formatDate(value, localeTag) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString(localeTag || 'id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

function statusBadgeClass(status) {
    const classes = {
        draft: 'text-violet-700',
        pending: 'text-amber-700',
        revision: 'text-red-700',
        published: 'text-emerald-700',
    };

    return classes[status] || 'text-slate-700';
}

function slaWarningBadgeClass(level) {
    if (level === 'critical') {
        return 'admin-dashboard-warning-badge admin-dashboard-warning-critical bg-red-100 text-red-700 border border-red-200';
    }

    if (level === 'warning') {
        return 'admin-dashboard-warning-badge admin-dashboard-warning-alert bg-amber-100 text-amber-700 border border-amber-200';
    }

    return 'admin-dashboard-warning-badge admin-dashboard-warning-safe bg-emerald-100 text-emerald-700 border border-emerald-200';
}

function MetricIcon({ kind }) {
    if (kind === 'published') {
        return (
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <circle cx="12" cy="12" r="8" />
                    <path d="m8.5 12 2.2 2.2L15.5 9.5" />
                </svg>
            </div>
        );
    }

    if (kind === 'review') {
        return (
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l2.5 1.5" />
                </svg>
            </div>
        );
    }

    if (kind === 'users') {
        return (
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <circle cx="9" cy="9" r="2.5" />
                    <path d="M4.5 18a4.5 4.5 0 0 1 9 0" />
                    <circle cx="16.5" cy="8.5" r="2" />
                    <path d="M14.5 17a4 4 0 0 1 5 1" />
                </svg>
            </div>
        );
    }

    return (
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M7.5 4.5h6l3 3V18a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 18V6A1.5 1.5 0 0 1 7.5 4.5z" />
                <path d="M13.5 4.5V7.5h3" />
            </svg>
        </div>
    );
}

function ActivityIcon() {
    return (
        <div className="admin-dashboard-activity-icon-wrap w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                <path d="M7.5 4.5h6l3 3V18a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 18V6A1.5 1.5 0 0 1 7.5 4.5z" />
                <path d="M13.5 4.5V7.5h3" />
            </svg>
        </div>
    );
}

export default function AdminDashboardPage() {
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);

    useErrorNotification(error, setError);

    useEffect(() => {
        async function load() {
            const token = getToken();
            setError('');
            setLoading(true);

            try {
                const payload = await apiRequest('/admin/dashboard', { token });
                if (payload?.status !== 'success') {
                    throw new Error(payload?.message || t('admin.dashboard.errorLoad', 'Gagal memuat dashboard admin.'));
                }

                setData(payload.data || {});
            } catch (err) {
                setError(err.message || t('admin.dashboard.errorLoadDefault', 'Terjadi kesalahan saat memuat dashboard.'));
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [t]);

    const metrics = data?.metrics || {};
    const statusMap = useMemo(() => {
        const map = {};

        (data?.article_status || []).forEach((row) => {
            map[row.status] = Number(row?.total) || 0;
        });

        return map;
    }, [data]);

    const statusRows = [
        { status: 'draft', total: statusMap.draft || 0 },
        { status: 'pending', total: statusMap.pending || 0 },
        { status: 'revision', total: statusMap.revision || 0 },
        { status: 'published', total: statusMap.published || 0 },
    ];

    const conicStyle = useMemo(() => {
        const activeRows = statusRows.filter((row) => row.total > 0);
        const total = activeRows.reduce((sum, row) => sum + row.total, 0);

        if (!total) {
            return { backgroundImage: 'conic-gradient(#e2e8f0 0% 100%)' };
        }

        const separator = 0.8;
        let cursor = 0;
        const parts = [];

        activeRows.forEach((row, index) => {
            const color = statusColorMap[row.status] || '#94a3b8';
            const slice = (row.total / total) * 100;
            const start = cursor;
            const end = cursor + slice;
            const isLast = index === activeRows.length - 1;

            const colorEnd = isLast ? end : Math.max(start, end - separator);
            parts.push(`${color} ${start.toFixed(2)}% ${colorEnd.toFixed(2)}%`);

            if (!isLast && colorEnd < end) {
                parts.push(`transparent ${colorEnd.toFixed(2)}% ${end.toFixed(2)}%`);
            }

            cursor = end;
        });

        return {
            backgroundImage: `conic-gradient(${parts.join(', ')})`,
        };
    }, [statusRows]);

    const latestArticles = data?.latest_articles || [];
    const recentActivities = data?.recent_activities || [];
    const reviewerSla = data?.reviewer_sla || [];
    const reviewerSlaSummary = data?.reviewer_sla_summary || {};

    const totalArticles = metrics.total_articles ?? 0;
    const totalPublished = metrics.total_published ?? 0;
    const pendingReview = metrics.pending_review ?? 0;
    const totalUsers = metrics.total_users ?? 0;

    const workflowStatusLabel = (status) => t(`workflow.status.${status}`, articleStatusLabel(status));

    return (
        <AdminShell title={t('admin.dashboard.title', 'Dashboard')}>
            <div className="admin-dashboard-page">
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                <article className="admin-page-panel rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between min-h-9">
                        <MetricIcon kind="articles" />
                        <span className="admin-dashboard-trend-pill text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">+12%</span>
                    </div>
                    <p className="mt-4 text-[34px] leading-none font-semibold text-slate-900">{totalArticles}</p>
                    <p className="mt-2 text-xs text-slate-500">{t('admin.dashboard.totalArticles', 'Total Berita')}</p>
                </article>

                <article className="admin-page-panel rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between min-h-9">
                        <MetricIcon kind="published" />
                        <span className="admin-dashboard-trend-pill text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">+8%</span>
                    </div>
                    <p className="mt-4 text-[34px] leading-none font-semibold text-slate-900">{totalPublished}</p>
                    <p className="mt-2 text-xs text-slate-500">{t('admin.dashboard.totalPublished', 'Total Published')}</p>
                </article>

                <article className="admin-page-panel rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between min-h-9">
                        <MetricIcon kind="review" />
                        <span className="admin-dashboard-trend-pill text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">+3</span>
                    </div>
                    <p className="mt-4 text-[34px] leading-none font-semibold text-slate-900">{pendingReview}</p>
                    <p className="mt-2 text-xs text-slate-500">{t('admin.dashboard.pendingReview', 'Menunggu Review')}</p>
                </article>

                <article className="admin-page-panel rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center justify-between min-h-9">
                        <MetricIcon kind="users" />
                        <span className="admin-dashboard-trend-pill text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">+5</span>
                    </div>
                    <p className="mt-4 text-[34px] leading-none font-semibold text-slate-900">{totalUsers}</p>
                    <p className="mt-2 text-xs text-slate-500">{t('admin.dashboard.totalUsers', 'Total User')}</p>
                </article>
            </section>

            <section className="admin-page-panel rounded-lg bg-white border border-slate-200 p-4 shadow-sm mb-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[22px] leading-tight font-semibold text-slate-900">
                            {t('admin.dashboard.reviewerSlaTitle', 'SLA Review Editor')}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {t('admin.dashboard.reviewerSlaSubtitle', 'Peringatan untuk antrean review yang lewat 48 jam.')}
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">
                            {t('admin.dashboard.reviewerWithWarning', 'Editor dengan warning')}
                        </p>
                        <p className="text-2xl font-semibold text-slate-900">
                            {Number(reviewerSlaSummary.reviewer_with_warning || reviewerSlaSummary.reviewers_with_warning || 0)}
                        </p>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="admin-page-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-2">{t('table.editor', 'Editor')}</th>
                                <th className="py-2.5 px-2">{t('admin.dashboard.assignedAuthors', 'Author Assigned')}</th>
                                <th className="py-2.5 px-2">{t('admin.dashboard.pendingReviews', 'Pending Review')}</th>
                                <th className="py-2.5 px-2">{t('admin.dashboard.overdue48h', '> 48 Jam')}</th>
                                <th className="py-2.5 px-2">{t('admin.dashboard.oldestPending', 'Pending Tertua')}</th>
                                <th className="py-2.5 px-2">{t('admin.dashboard.warningLevel', 'Level')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : reviewerSla.length ? (
                                reviewerSla.map((row) => (
                                    <tr key={row.reviewer_id}>
                                        <td className="py-3 px-2 text-slate-800 font-medium">
                                            {row.reviewer_name}
                                            {' '}
                                            <span className={`admin-dashboard-reviewer-status ml-2 px-2 py-0.5 rounded text-[10px] font-semibold ${row.reviewer_status === 'active' ? 'admin-dashboard-reviewer-status-active bg-emerald-100 text-emerald-700' : 'admin-dashboard-reviewer-status-inactive bg-slate-200 text-slate-700'}`}>
                                                {t(`status.${row.reviewer_status}`, row.reviewer_status)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-slate-600">{Number(row.assigned_authors_total || 0)}</td>
                                        <td className="py-3 px-2 text-slate-600">{Number(row.pending_articles_total || 0)}</td>
                                        <td className="py-3 px-2 text-slate-700 font-semibold">{Number(row.overdue_pending_total || 0)}</td>
                                        <td className="py-3 px-2 text-slate-500">
                                            {row.oldest_pending_hours !== null && row.oldest_pending_hours !== undefined
                                                ? t('admin.dashboard.hoursLabel', '{hours} jam', { hours: row.oldest_pending_hours })
                                                : '-'}
                                        </td>
                                        <td className="py-3 px-2">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${slaWarningBadgeClass(row.warning_level)}`}>
                                                {row.warning_level === 'critical'
                                                    ? t('admin.dashboard.critical', 'Kritis')
                                                    : row.warning_level === 'warning'
                                                        ? t('admin.dashboard.warning', 'Warning')
                                                        : t('admin.dashboard.safe', 'Aman')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-6 text-center text-slate-400">
                                        {t('admin.dashboard.emptyReviewerSla', 'Belum ada data SLA reviewer.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="admin-page-panel rounded-lg bg-white border border-slate-200 p-5 shadow-sm mb-5 min-h-[250px]">
                <h2 className="text-[26px] leading-tight font-semibold text-slate-900">{t('admin.dashboard.articleStatus', 'Status Artikel')}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('admin.dashboard.workflowCaption', 'Berdasarkan workflow jurnal: Draft, Review, Revisi, Published')}</p>

                <div className="mt-8 flex items-center justify-center gap-12">
                    <div className="relative w-44 h-44 rounded-full bg-slate-100" style={conicStyle}>
                        <div className="absolute inset-[32%] rounded-full bg-white border border-slate-100" />
                    </div>

                    <ul className="space-y-2 text-sm w-48">
                        {statusRows.map((row) => (
                            <li key={row.status} className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-slate-700">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: statusColorMap[row.status] || '#94a3b8' }} />
                                    <span>{workflowStatusLabel(row.status)}</span>
                                </span>
                                <span className={`font-medium ${statusBadgeClass(row.status)}`}>- {row.total}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="admin-page-panel xl:col-span-2 rounded-lg bg-white border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[20px] font-semibold text-slate-900">{t('admin.dashboard.latestArticles', 'Artikel Terbaru')}</h3>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="admin-page-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                    <th className="py-2.5 px-2">{t('table.title', 'Judul')}</th>
                                    <th className="py-2.5 px-2">{t('table.author', 'Penulis')}</th>
                                    <th className="py-2.5 px-2">{t('table.status', 'Status')}</th>
                                    <th className="py-2.5 px-2">{t('table.date', 'Tanggal')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                    </tr>
                                ) : latestArticles.length ? (
                                    latestArticles.map((article) => (
                                        <tr key={article.id}>
                                            <td className="py-3 px-2 text-slate-800 font-medium">{t(`admin.dashboard.articleTitle.${article.id}`, article.title || '-')}</td>
                                            <td className="py-3 px-2 text-slate-600">{t(`admin.dashboard.articleAuthor.${article.id}`, article.author_name || '-')}</td>
                                            <td className="py-3 px-2">
                                                <span className={`admin-page-status-badge px-2.5 py-1 rounded-full text-xs font-semibold ${articleStatusBadgeClass(article.status)}`}>
                                                    {workflowStatusLabel(article.status)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-slate-500">{formatDate(article.date, intlLocale)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-6 text-center text-slate-400">{t('admin.dashboard.emptyArticles', 'Belum ada artikel.')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 text-right">
                        <Link to="/admin/articles" className="admin-page-link text-sm font-semibold text-blue-600 hover:text-blue-700">
                            {t('admin.dashboard.viewAll', 'Lihat Semua')} →
                        </Link>
                    </div>
                </div>

                <div className="admin-page-panel rounded-lg bg-white border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-[20px] font-semibold text-slate-900">{t('admin.dashboard.latestActivities', 'Aktivitas Terbaru')}</h3>
                    <ul className="mt-4 space-y-3 text-sm">
                        {loading ? (
                            <li className="text-slate-400">{t('common.loadingData', 'Memuat data...')}</li>
                        ) : recentActivities.length ? (
                            recentActivities.map((activity, index) => (
                                <li key={`${activity.message}-${index}`} className="flex items-center gap-2.5">
                                    <ActivityIcon />
                                    <div>
                                        <p className="text-slate-700">{t(`admin.dashboard.activityMessage.${index}`, activity.message || '-')}</p>
                                        <p className="text-xs text-slate-500 mt-1">{t(`admin.dashboard.activityTime.${index}`, activity.time || '-')}</p>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="text-slate-400">{t('admin.dashboard.emptyActivities', 'Belum ada aktivitas.')}</li>
                        )}
                    </ul>

                    <div className="mt-4">
                        <Link to="/admin/activities" className="admin-page-link text-sm font-semibold text-blue-600 hover:text-blue-700">
                            {t('admin.dashboard.viewFullLog', 'Lihat Log Lengkap')} →
                        </Link>
                    </div>
                </div>
            </section>
            </div>
        </AdminShell>
    );
}
