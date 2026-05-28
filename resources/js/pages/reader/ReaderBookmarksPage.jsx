import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReaderShell from '../../components/ReaderShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { articleImageUrl } from '../../lib/media';
import { useErrorNotification, useNotify } from '../../lib/notify';

function formatDate(value, localeTag) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString(localeTag || 'id-ID', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
}

function formatDateTime(value, localeTag) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString(localeTag || 'id-ID', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function estimateReadMinutesFromBookmark(article) {
    const source = `${article?.title || ''} ${article?.excerpt || ''}`.trim();
    if (!source) {
        return 1;
    }

    const words = source.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
}

function isSameLocalDate(value, dateReference) {
    if (!value) {
        return false;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return false;
    }

    return (
        date.getFullYear() === dateReference.getFullYear()
        && date.getMonth() === dateReference.getMonth()
        && date.getDate() === dateReference.getDate()
    );
}

export default function ReaderBookmarksPage() {
    const navigate = useNavigate();
    const notify = useNotify();
    const { t, intlLocale } = useI18n();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [page, setPage] = useState(1);
    const [bookmarks, setBookmarks] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        current_page: 1,
        last_page: 1,
    });

    useErrorNotification(error, setError);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setPage(1);
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    async function loadBookmarks(targetPage = page) {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                per_page: '12',
                q: search,
                category_id: categoryId,
            });

            const payload = await apiRequest(`/user/bookmarks?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.bookmarks.errorLoad', 'Gagal memuat daftar bookmark.'));
            }

            setBookmarks(payload?.data?.bookmarks || []);
            setPagination(payload?.data?.pagination || {
                total: 0,
                current_page: 1,
                last_page: 1,
            });
            setCategoryOptions(payload?.data?.filters?.category_options || []);
        } catch (err) {
            setError(err.message || t('reader.bookmarks.errorLoadDefault', 'Terjadi kesalahan saat memuat bookmark.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadBookmarks(page);
    }, [page, search, categoryId]);

    async function removeBookmark(row) {
        const articleId = row?.article?.id;
        if (!articleId) {
            return;
        }

        const token = getToken();
        setError('');

        try {
            const payload = await apiRequest(`/user/articles/${articleId}/bookmark`, {
                method: 'POST',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.bookmarks.errorRemove', 'Gagal menghapus bookmark.'));
            }

            const shouldMovePreviousPage = bookmarks.length === 1 && page > 1;
            setBookmarks((previous) => previous.filter((item) => item.article?.id !== articleId));
            setPagination((previous) => ({
                ...previous,
                total: Math.max(0, Number(previous.total || 0) - 1),
            }));

            if (shouldMovePreviousPage) {
                setPage((previous) => Math.max(1, previous - 1));
            }

            notify.success(t('reader.bookmarks.removed', 'Bookmark berhasil dihapus.'));
        } catch (err) {
            setError(err.message || t('reader.bookmarks.errorRemoveDefault', 'Terjadi kesalahan saat menghapus bookmark.'));
        }
    }

    const featuredBookmark = useMemo(() => (bookmarks.length ? bookmarks[0] : null), [bookmarks]);
    const listBookmarks = useMemo(() => (bookmarks.length > 1 ? bookmarks.slice(1) : []), [bookmarks]);
    const todaySavedCount = useMemo(() => {
        const today = new Date();
        return bookmarks.filter((row) => isSameLocalDate(row.bookmarked_at, today)).length;
    }, [bookmarks]);
    const hasActiveFilter = Boolean(search.trim()) || Boolean(categoryId);
    const visibleCount = featuredBookmark ? 1 + listBookmarks.length : listBookmarks.length;

    return (
        <ReaderShell
            shellClassName="reader-shell-news-portal"
            title={t('reader.bookmarks.title', 'Bookmark Saya')}
            subtitle={t('reader.bookmarks.subtitle', '{count} berita tersimpan', { count: pagination.total || 0 })}
        >
            <section className="reader-home-controls rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder={t('reader.bookmarks.search', 'Cari bookmark berdasarkan judul...')}
                        className="reader-home-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    />

                    <select
                        value={categoryId}
                        onChange={(event) => {
                            setPage(1);
                            setCategoryId(event.target.value);
                        }}
                        className="reader-home-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="">{t('reader.bookmarks.allCategories', 'Semua kategori')}</option>
                        {categoryOptions.map((category) => (
                            <option key={category.id} value={String(category.id)}>{category.name}</option>
                        ))}
                    </select>
                </div>

                <div className="reader-bookmarks-kpi-grid mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <article className="reader-bookmark-stat rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('reader.bookmarks.kpiTotal', 'Total Simpanan')}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{pagination.total || 0}</p>
                    </article>

                    <article className="reader-bookmark-stat rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('reader.bookmarks.kpiToday', 'Ditandai Hari Ini')}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{todaySavedCount}</p>
                    </article>

                    <article className="reader-bookmark-stat rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t('reader.bookmarks.kpiVisible', 'Ditampilkan')}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{visibleCount}</p>
                    </article>
                </div>
            </section>

            <section className="mt-5">
                {loading ? (
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                        {t('common.loadingData', 'Memuat data...')}
                    </article>
                ) : bookmarks.length ? (
                    <div className="space-y-4">
                        {featuredBookmark ? (
                            <article className="reader-bookmark-feature rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm overflow-hidden">
                                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-stretch">
                                    <div>
                                        <p className="reader-eyebrow text-[11px] uppercase tracking-[0.12em] text-blue-700 font-semibold">
                                            {t('reader.bookmarks.featured', 'Pilihan Koleksi')} • {featuredBookmark.article?.category_name || '-'}
                                        </p>

                                        <Link to={`/reader/articles/${featuredBookmark.article?.slug || featuredBookmark.article?.id}`}>
                                            <h2 className="reader-display mt-2 text-3xl md:text-4xl leading-[1.06] font-semibold text-slate-900 hover:text-blue-700 transition-colors">
                                                {featuredBookmark.article?.title || '-'}
                                            </h2>
                                        </Link>

                                        <p className="mt-3 text-sm leading-7 text-slate-600">
                                            {featuredBookmark.article?.excerpt || t('reader.home.noExcerpt', 'Ringkasan belum tersedia.')}
                                        </p>

                                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="reader-bookmark-meta-chip">{featuredBookmark.article?.author_name || '-'}</span>
                                            <span className="reader-bookmark-meta-chip">{formatDate(featuredBookmark.article?.date, intlLocale)}</span>
                                            <span className="reader-bookmark-meta-chip">{t('reader.home.minutesRead', '{count} menit baca', { count: estimateReadMinutesFromBookmark(featuredBookmark.article) })}</span>
                                            <span className="reader-bookmark-meta-chip">{t('reader.bookmarks.savedAt', 'Disimpan: {date}', { date: formatDateTime(featuredBookmark.bookmarked_at, intlLocale) })}</span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <Link
                                                to={`/reader/articles/${featuredBookmark.article?.slug || featuredBookmark.article?.id}`}
                                                className="portal-btn portal-btn-primary portal-btn-sm"
                                            >
                                                {t('reader.bookmarks.readNow', 'Baca Sekarang')}
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={() => removeBookmark(featuredBookmark)}
                                                className="portal-btn portal-btn-secondary portal-btn-sm reader-bookmark-remove"
                                            >
                                                {t('reader.bookmarks.remove', 'Hapus Bookmark')}
                                            </button>
                                        </div>
                                    </div>

                                    <Link to={`/reader/articles/${featuredBookmark.article?.slug || featuredBookmark.article?.id}`} className="reader-bookmark-feature-media rounded-xl overflow-hidden bg-slate-100 h-[240px] lg:h-auto">
                                        {featuredBookmark.article?.featured_image ? (
                                            <img src={articleImageUrl(featuredBookmark.article)} alt={featuredBookmark.article.featured_image_alt || featuredBookmark.article.title || '-'} className="w-full h-full object-cover" decoding="async" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                                        )}
                                    </Link>
                                </div>
                            </article>
                        ) : null}

                        {listBookmarks.length ? (
                            <div className="space-y-3">
                                <div className="reader-bookmark-list-head flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                                    <div>
                                        <h3 className="reader-display text-2xl font-semibold text-slate-900">{t('reader.bookmarks.moreSaved', 'Simpanan Lainnya')}</h3>
                                        <p className="text-sm text-slate-600">{hasActiveFilter ? t('reader.bookmarks.filterActive', 'Filter aktif: "{term}"', { term: search }) : t('reader.bookmarks.filterNone', 'Menampilkan semua berita yang sudah kamu simpan.')}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {listBookmarks.map((row) => {
                                        const article = row.article || {};
                                        const imageUrl = articleImageUrl(article);

                                        return (
                                            <article key={row.bookmark_id} className="reader-bookmark-card rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                <Link to={`/reader/articles/${article.slug || article.id}`} className="reader-bookmark-card-media block h-44 bg-slate-100">
                                                    {imageUrl ? (
                                                        <img src={imageUrl} alt={article.featured_image_alt || article.title || '-'} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                                                    )}
                                                </Link>

                                                <div className="reader-bookmark-card-content p-4">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] uppercase tracking-[0.12em] text-blue-700 font-semibold">{article.category_name || '-'}</p>
                                                        <p className="text-[11px] text-slate-500">{t('reader.home.minutesRead', '{count} menit baca', { count: estimateReadMinutesFromBookmark(article) })}</p>
                                                    </div>

                                                    <Link to={`/reader/articles/${article.slug || article.id}`}>
                                                        <h3 className="reader-display mt-1 text-xl font-semibold text-slate-900 line-clamp-2 hover:text-blue-700 transition-colors">
                                                            {article.title || '-'}
                                                        </h3>
                                                    </Link>

                                                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{article.excerpt || t('reader.home.noExcerpt', 'Ringkasan belum tersedia.')}</p>

                                                    <div className="mt-3 text-xs text-slate-500 space-y-1">
                                                        <p>{article.author_name || '-'}</p>
                                                        <p>{formatDate(article.date, intlLocale)}</p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => removeBookmark(row)}
                                                        className="reader-bookmark-remove mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                                    >
                                                        {t('reader.bookmarks.remove', 'Hapus Bookmark')}
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <article className="reader-bookmark-empty rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm text-sm text-slate-500">
                        <p className="reader-display text-2xl md:text-3xl text-slate-900 font-semibold">{t('reader.bookmarks.emptyTitle', 'Belum Ada Bookmark')}</p>
                        <p className="mt-2 max-w-xl text-slate-600">{t('reader.bookmarks.empty', 'Belum ada berita yang disimpan.')}</p>
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/reader/home')}
                                className="portal-btn portal-btn-primary"
                            >
                                {t('reader.bookmarks.startExploring', 'Mulai Jelajahi Berita')}
                            </button>
                        </div>
                    </article>
                )}
            </section>

            <section className="mt-5 flex items-center justify-center gap-2 text-sm">
                <button
                    type="button"
                    disabled={pagination.current_page <= 1 || loading}
                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    className="reader-pagination-btn rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 disabled:opacity-50"
                >
                    {t('pagination.prev', 'Sebelumnya')}
                </button>

                <span className="reader-pagination-active rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-white">
                    {pagination.current_page || 1}
                </span>

                <button
                    type="button"
                    disabled={pagination.current_page >= pagination.last_page || loading}
                    onClick={() => setPage((previous) => Math.min(pagination.last_page || 1, previous + 1))}
                    className="reader-pagination-btn rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 disabled:opacity-50"
                >
                    {t('pagination.next', 'Berikutnya')}
                </button>
            </section>
        </ReaderShell>
    );
}
