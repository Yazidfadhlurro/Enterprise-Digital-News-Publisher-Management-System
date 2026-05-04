import React, { useEffect, useState } from 'react';
import EditorShell from '../../components/EditorShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { articleStatusBadgeClass, articleStatusLabel } from '../../lib/articleWorkflow';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

function StatCard({ label, value, tone = 'blue' }) {
    const toneClasses = {
        blue: 'bg-blue-50 border-blue-100 text-blue-700',
        amber: 'bg-amber-50 border-amber-100 text-amber-700',
        emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    };

    return (
        <article className={`rounded-xl border p-4 ${toneClasses[tone]} bg-white`}>
            <p className="text-xs uppercase tracking-wide font-semibold opacity-75">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        </article>
    );
}

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

export default function EditorDashboardPage() {
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({
        metrics: {
            review_total: 0,
            published_total: 0,
            today_review_total: 0,
        },
        recent_review_articles: [],
    });

    useErrorNotification(error, setError);

    async function loadDashboard() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest('/reviewer/dashboard', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('editor.dashboard.errorLoad', 'Gagal memuat dashboard editor.'));
            }

            setSummary(payload?.data || {});
        } catch (err) {
            setError(err.message || t('editor.dashboard.errorLoadDefault', 'Terjadi kesalahan saat memuat dashboard editor.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDashboard();
    }, [t]);

    const workflowStatusLabel = (status) => t(`workflow.status.${status}`, articleStatusLabel(status));

    return (
        <EditorShell title={t('editor.dashboard.title', 'Dashboard')}>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <StatCard label={t('editor.dashboard.reviewNews', 'Berita Review')} value={summary?.metrics?.review_total || 0} tone="blue" />
                <StatCard label={t('editor.dashboard.totalPublished', 'Total Publikasi')} value={summary?.metrics?.published_total || 0} tone="emerald" />
                <StatCard label={t('editor.dashboard.todayReview', 'Review Hari Ini')} value={summary?.metrics?.today_review_total || 0} tone="amber" />
            </section>

            <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-900">{t('editor.dashboard.latestForReview', 'Berita terbaru untuk ditinjau')}</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-4">{t('table.title', 'Judul')}</th>
                                <th className="py-2.5 px-4">{t('table.author', 'Penulis')}</th>
                                <th className="py-2.5 px-4">{t('table.status', 'Status')}</th>
                                <th className="py-2.5 px-4">{t('table.date', 'Tanggal')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : summary?.recent_review_articles?.length ? (
                                summary.recent_review_articles.map((article) => (
                                    <tr key={article.id}>
                                        <td className="py-3 px-4 text-slate-800 font-medium">{t(`editor.dashboard.articleTitle.${article.id}`, article.title || '-')}</td>
                                        <td className="py-3 px-4 text-slate-600">{t(`editor.dashboard.articleAuthor.${article.id}`, article.author_name || '-')}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${articleStatusBadgeClass(article.status)}`}>
                                                {workflowStatusLabel(article.status)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-500">{formatDate(article.date, intlLocale)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400">{t('editor.dashboard.emptyLatestReview', 'Belum ada berita review terbaru.')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </EditorShell>
    );
}
