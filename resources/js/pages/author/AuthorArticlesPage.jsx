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

function dynamicKey(prefix, value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return `${prefix}.empty`;
    }

    return `${prefix}.${encodeURIComponent(text).slice(0, 140)}`;
}

export default function AuthorArticlesPage() {
    const navigate = useNavigate();
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [articles, setArticles] = useState([]);
    const [total, setTotal] = useState(0);

    useErrorNotification(error, setError);

    async function loadArticles() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest('/author/articles?per_page=20', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('author.articles.errorLoad', 'Gagal memuat artikel penulis.'));
            }

            setArticles(payload?.data?.articles || []);
            setTotal(payload?.data?.pagination?.total || 0);
        } catch (err) {
            setError(err.message || t('author.articles.errorLoadDefault', 'Terjadi kesalahan saat memuat artikel penulis.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadArticles();
    }, []);

    return (
        <AuthorShell
            title={t('author.articles.title', 'Artikel Saya')}
            subtitle={t('author.articles.subtitle', '{count} artikel', { count: total })}
            action={(
                <button
                    type="button"
                    onClick={() => navigate('/author/articles/create')}
                    className="portal-btn portal-btn-primary portal-btn-sm"
                >
                    {t('author.dashboard.createArticle', 'Buat Artikel')}
                </button>
            )}
        >
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                                        <td className="py-3 px-3 text-slate-800 font-medium">{t(dynamicKey('author.articles.titleText', article.title), article.title)}</td>
                                        <td className="py-3 px-3 text-slate-600">{t(dynamicKey('author.articles.categoryText', article.category_name), article.category_name)}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${articleStatusBadgeClass(article.status)}`}>
                                                {t(`workflow.status.${article.status}`, articleStatusLabel(article.status))}
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
