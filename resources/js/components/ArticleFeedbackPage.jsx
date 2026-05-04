import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { getToken } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useErrorNotification } from '../lib/notify';

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

function dynamicKey(prefix, value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return `${prefix}.empty`;
    }

    return `${prefix}.${encodeURIComponent(text).slice(0, 140)}`;
}

function statusBadgeClass(status) {
    const map = {
        draft: 'bg-violet-100 text-violet-700',
        pending: 'bg-amber-100 text-amber-700',
        approved: 'bg-amber-100 text-amber-700',
        revision: 'bg-rose-100 text-rose-700',
        published: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-700',
    };

    return map[status] || 'bg-slate-100 text-slate-700';
}

export default function ArticleFeedbackPage({
    Shell,
    title,
    endpoint,
    buildViewPath,
    viewButtonLabel,
    showInsights = false,
}) {
    const { t, intlLocale } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();

    const initialSearch = (searchParams.get('q') || '').trim();
    const initialCategory = searchParams.get('category_id') || '';
    const initialArticle = searchParams.get('article_id') || '';
    const initialPageRaw = Number(searchParams.get('page') || 1);
    const initialPage = Number.isFinite(initialPageRaw) && initialPageRaw > 0 ? Math.floor(initialPageRaw) : 1;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [search, setSearch] = useState(initialSearch);
    const [categoryFilter, setCategoryFilter] = useState(initialCategory);
    const [articleFilter, setArticleFilter] = useState(initialArticle);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [articleOptions, setArticleOptions] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [summary, setSummary] = useState({
        articles_with_feedback: 0,
        comments_total: 0,
        ratings_total: 0,
        average_rating: 0,
        low_rating_articles: 0,
    });
    const [pagination, setPagination] = useState({
        total: 0,
        current_page: 1,
        last_page: 1,
    });
    const [page, setPage] = useState(initialPage);

    useErrorNotification(error, setError);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setPage(1);
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    useEffect(() => {
        const nextSearch = (searchParams.get('q') || '').trim();
        const nextCategory = searchParams.get('category_id') || '';
        const nextArticle = searchParams.get('article_id') || '';
        const nextPageRaw = Number(searchParams.get('page') || 1);
        const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw > 0 ? Math.floor(nextPageRaw) : 1;

        setSearchInput((previous) => (previous === nextSearch ? previous : nextSearch));
        setSearch((previous) => (previous === nextSearch ? previous : nextSearch));
        setCategoryFilter((previous) => (previous === nextCategory ? previous : nextCategory));
        setArticleFilter((previous) => (previous === nextArticle ? previous : nextArticle));
        setPage((previous) => (previous === nextPage ? previous : nextPage));
    }, [searchParams]);

    useEffect(() => {
        const nextParams = new URLSearchParams();

        if (search) {
            nextParams.set('q', search);
        }

        if (categoryFilter) {
            nextParams.set('category_id', categoryFilter);
        }

        if (articleFilter) {
            nextParams.set('article_id', articleFilter);
        }

        if (page > 1) {
            nextParams.set('page', String(page));
        }

        const current = searchParams.toString();
        const target = nextParams.toString();

        if (current !== target) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [search, categoryFilter, articleFilter, page, searchParams, setSearchParams]);

    async function loadFeedback(targetPage = page) {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                per_page: '10',
                q: search,
                category_id: categoryFilter || '',
                article_id: articleFilter || '',
            });

            const payload = await apiRequest(`${endpoint}?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('feedback.errorLoad', 'Gagal memuat komentar dan rating berita.'));
            }

            setFeedback(payload?.data?.feedback || []);
            setSummary(payload?.data?.summary || {
                articles_with_feedback: 0,
                comments_total: 0,
                ratings_total: 0,
                average_rating: 0,
                low_rating_articles: 0,
            });
            setCategoryOptions(payload?.data?.filters?.category_options || []);
            setArticleOptions(payload?.data?.filters?.article_options || []);
            setPagination(payload?.data?.pagination || { total: 0, current_page: 1, last_page: 1 });
        } catch (err) {
            setError(err.message || t('feedback.errorLoadDefault', 'Terjadi kesalahan saat memuat komentar dan rating berita.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadFeedback(page);
    }, [page, search, categoryFilter, articleFilter]);

    const resolvedViewButtonLabel = viewButtonLabel || t('feedback.openArticle', 'Lihat Berita');

    return (
        <Shell
            title={title}
            subtitle={t('feedback.subtitle', '{count} berita memiliki data komentar/rating', {
                count: pagination.total || 0,
            })}
            action={(
                <button
                    type="button"
                    onClick={() => loadFeedback(page)}
                    disabled={loading}
                    className="portal-btn portal-btn-primary"
                >
                    {loading ? t('common.loading', 'Memuat...') : t('common.refresh', 'Muat Ulang')}
                </button>
            )}
        >
            {showInsights ? (
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{t('feedback.insightArticles', 'Artikel Dengan Feedback')}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{Number(summary.articles_with_feedback || 0)}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{t('feedback.totalComments', 'Jumlah Komentar')}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{Number(summary.comments_total || 0)}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{t('feedback.totalRating', 'Jumlah Rating')}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{Number(summary.ratings_total || 0)}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{t('feedback.avgRating', 'Rata-rata Rating')}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{Number(summary.average_rating || 0).toFixed(2)}</p>
                    </article>
                    <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-rose-600">{t('feedback.lowRatingArticles', 'Rating Rendah (<= 3)')}</p>
                        <p className="mt-2 text-2xl font-semibold text-rose-700">{Number(summary.low_rating_articles || 0)}</p>
                    </article>
                </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t('feedback.searchPlaceholder', 'Cari judul berita atau penulis...')}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    />

                    <select
                        value={categoryFilter}
                        onChange={(event) => {
                            setPage(1);
                            setCategoryFilter(event.target.value);
                            setArticleFilter('');
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="">{t('feedback.filterAllCategories', 'Semua Kategori')}</option>
                        {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {t(
                                    dynamicKey('feedback.filterCategory', `${option.name || '-'} (${Number(option.articles_total || 0)})`),
                                    `${option.name || '-'} (${Number(option.articles_total || 0)})`
                                )}
                            </option>
                        ))}
                    </select>

                    <select
                        value={articleFilter}
                        onChange={(event) => {
                            setPage(1);
                            setArticleFilter(event.target.value);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="">{t('feedback.filterAllArticles', 'Semua Berita')}</option>
                        {articleOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {t(dynamicKey('feedback.filterArticle', option.title), option.title || '-')}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1180px]">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-3">{t('table.title', 'Judul')}</th>
                                <th className="py-2.5 px-3">{t('table.author', 'Penulis')}</th>
                                <th className="py-2.5 px-3">{t('table.status', 'Status')}</th>
                                <th className="py-2.5 px-3">{t('feedback.avgRating', 'Rata-rata Rating')}</th>
                                <th className="py-2.5 px-3">{t('feedback.totalRating', 'Jumlah Rating')}</th>
                                <th className="py-2.5 px-3">{t('feedback.totalComments', 'Jumlah Komentar')}</th>
                                <th className="py-2.5 px-3">{t('feedback.latestComment', 'Komentar Terbaru')}</th>
                                <th className="py-2.5 px-3">{t('feedback.latestReader', 'Pembaca')}</th>
                                <th className="py-2.5 px-3">{t('table.time', 'Waktu')}</th>
                                <th className="py-2.5 px-3">{t('table.action', 'Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : feedback.length ? (
                                feedback.map((row) => (
                                    <tr key={row.article_id}>
                                        <td className="py-3 px-3 text-slate-800 font-medium">{t(dynamicKey('feedback.title', row.title), row.title || '-')}</td>
                                        <td className="py-3 px-3 text-slate-600">{t(dynamicKey('feedback.author', row.author_name), row.author_name || '-')}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                                                {t(`workflow.status.${row.status}`, row.status_label || row.status || '-')}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-700 font-semibold">{Number(row.average_rating || 0).toFixed(2)}</td>
                                        <td className="py-3 px-3 text-slate-600">{Number(row.ratings_total || 0)}</td>
                                        <td className="py-3 px-3 text-slate-600">{Number(row.comments_total || 0)}</td>
                                        <td className="py-3 px-3 text-slate-600 max-w-[260px]">
                                            <span className="block truncate">{row.latest_comment ? t(dynamicKey('feedback.latestCommentText', row.latest_comment), row.latest_comment) : '-'}</span>
                                        </td>
                                        <td className="py-3 px-3 text-slate-600">{row.latest_commenter_name ? t(dynamicKey('feedback.latestReaderText', row.latest_commenter_name), row.latest_commenter_name) : '-'}</td>
                                        <td className="py-3 px-3 text-slate-500">{formatDateTime(row.latest_comment_at || row.updated_at, intlLocale)}</td>
                                        <td className="py-3 px-3">
                                            {typeof buildViewPath === 'function' && buildViewPath(row) ? (
                                                <Link
                                                    to={buildViewPath(row)}
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                >
                                                    {resolvedViewButtonLabel}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10} className="py-6 text-center text-slate-400">{t('feedback.empty', 'Belum ada data komentar atau rating.')}</td>
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
                        onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    >
                        {t('pagination.prev', 'Sebelumnya')}
                    </button>

                    <span className="px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white">
                        {pagination.current_page || 1}
                    </span>

                    <button
                        type="button"
                        disabled={pagination.current_page >= pagination.last_page}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setPage((previous) => Math.min(pagination.last_page || 1, previous + 1))}
                    >
                        {t('pagination.next', 'Berikutnya')}
                    </button>
                </div>
            </section>
        </Shell>
    );
}
