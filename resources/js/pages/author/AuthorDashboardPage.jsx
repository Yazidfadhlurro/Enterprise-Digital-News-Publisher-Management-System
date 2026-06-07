import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthorShell from '../../components/AuthorShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { articleStatusBadgeClass, articleStatusLabel } from '../../lib/articleWorkflow';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

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

function StatCard({ value, label, valueClassName }) {
    return (
        <article className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className={`text-[26px] leading-none font-semibold ${valueClassName}`}>{value}</p>
            <p className="mt-2 text-xs text-slate-500">{label}</p>
        </article>
    );
}

export default function AuthorDashboardPage() {
    const navigate = useNavigate();
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [metrics, setMetrics] = useState({
        draft_total: 0,
        review_total: 0,
        revision_total: 0,
        published_total: 0,
    });
    const [articles, setArticles] = useState([]);

    useErrorNotification(error, setError);

    async function loadDashboard() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest('/author/dashboard', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('author.dashboard.errorLoad', 'Gagal memuat dashboard penulis.'));
            }

            setMetrics(payload?.data?.metrics || {
                draft_total: 0,
                review_total: 0,
                revision_total: 0,
                published_total: 0,
            });
            setArticles(payload?.data?.articles || []);
        } catch (err) {
            setError(err.message || t('author.dashboard.errorLoadDefault', 'Terjadi kesalahan saat memuat dashboard penulis.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDashboard();
    }, [t]);

    const workflowStatusLabel = (status) => t(`workflow.status.${status}`, articleStatusLabel(status));

    return (
        <AuthorShell title={t('author.dashboard.title', 'Dashboard Penulis')}>
            <section>
                <h2 className="text-3xl font-semibold text-slate-900">{t('author.dashboard.heading', 'Dashboard Penulis')}</h2>
            </section>

            <section className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard value={metrics.draft_total || 0} label={t('workflow.status.draft', 'Draft')} valueClassName="text-violet-600" />
                <StatCard value={metrics.review_total || 0} label={t('workflow.status.pending', 'Review')} valueClassName="text-amber-600" />
                <StatCard value={metrics.revision_total || 0} label={t('workflow.status.revision', 'Revisi')} valueClassName="text-red-600" />
                <StatCard value={metrics.published_total || 0} label={t('workflow.status.published', 'Publikasi')} valueClassName="text-emerald-600" />
            </section>

            <section className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{t('author.dashboard.myArticles', 'Artikel Saya')}</h3>
                    <button
                        type="button"
                        onClick={() => navigate('/author/articles/create')}
                        className="portal-btn portal-btn-primary portal-btn-sm"
                    >
                        {t('author.dashboard.createArticle', 'Buat Artikel')}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-3">{t('table.title', 'Judul')}</th>
                                <th className="py-2.5 px-3">{t('table.category', 'Kategori')}</th>
                                <th className="py-2.5 px-3">{t('table.status', 'Status')}</th>
                                <th className="py-2.5 px-3">{t('author.dashboard.lastUpdated', 'Terakhir Diubah')}</th>
                                <th className="py-2.5 px-3">{t('table.action', 'Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : articles.length ? (
                                articles.map((article) => (
                                    <tr key={article.id}>
                                        <td className="py-3 px-3 text-slate-800 font-medium">{t(`author.dashboard.articleTitle.${article.id}`, article.title || '-')}</td>
                                        <td className="py-3 px-3 text-slate-600">{t(`author.dashboard.articleCategory.${article.id}`, article.category_name || '-')}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${articleStatusBadgeClass(article.status)}`}>
                                                {workflowStatusLabel(article.status)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-500">{formatDate(article.updated_at, intlLocale)}</td>
                                        <td className="py-3 px-3">
                                            {article.can_edit ? (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/author/articles/${article.id}/edit`)}
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                >
                                                    {t('table.edit', 'Edit')}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/author/articles/${article.id}/view`)}
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                >
                                                    {t('table.detail', 'Lihat')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">{t('author.dashboard.emptyArticles', 'Belum ada artikel.')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </AuthorShell>
    );
}
