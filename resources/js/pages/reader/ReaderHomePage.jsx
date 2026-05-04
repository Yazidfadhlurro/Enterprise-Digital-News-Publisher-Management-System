import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReaderShell from '../../components/ReaderShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

function resolveImageUrl(value) {
    if (!value) return '';

    if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) {
        return value;
    }

    if (value.startsWith('storage/')) {
        return `/${value}`;
    }

    return `/storage/${value.replace(/^\/+/, '')}`;
}

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

function estimateReadingMinutes(article) {
    const source = `${article?.title || ''} ${article?.excerpt || ''}`.trim();
    if (!source) {
        return 1;
    }

    const words = source.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
}

function normalizeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDateTimestamp(value) {
    if (!value) return 0;

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function computeHoursAgo(value) {
    const timestamp = resolveDateTimestamp(value);
    if (!timestamp) {
        return 240;
    }

    const diffMilliseconds = Math.max(0, Date.now() - timestamp);
    return diffMilliseconds / (1000 * 60 * 60);
}

function computeTrendingScore(article) {
    const views = normalizeNumber(article?.views_count);
    const comments = normalizeNumber(article?.comments_total);
    const ratingAverage = normalizeNumber(article?.average_rating);
    const ratingTotal = normalizeNumber(article?.ratings_total);
    const isFeatured = article?.is_featured ? 1 : 0;
    const recencyHours = computeHoursAgo(article?.date || article?.published_at);
    const freshnessFactor = Math.max(0.35, 1.3 - (recencyHours / 168));

    const engagementScore = (
        (Math.log10(views + 10) * 3.2)
        + (comments * 1.4)
        + (ratingAverage * 2.2)
        + (Math.log10(ratingTotal + 2) * 2.0)
        + (isFeatured * 1.2)
    ) * freshnessFactor;

    return Number(engagementScore.toFixed(4));
}

function computeEditorsPickScore(article) {
    const views = normalizeNumber(article?.views_count);
    const comments = normalizeNumber(article?.comments_total);
    const ratingAverage = normalizeNumber(article?.average_rating);
    const ratingTotal = normalizeNumber(article?.ratings_total);
    const isFeatured = article?.is_featured ? 1 : 0;
    const readMinutes = estimateReadingMinutes(article);

    const editorialScore = (
        (ratingAverage * 2.8)
        + (Math.log10(ratingTotal + 2) * 2.6)
        + (Math.log10(views + 20) * 1.8)
        + (Math.log10(comments + 2) * 2.1)
        + (isFeatured * 1.4)
        + (Math.min(7, readMinutes) * 0.18)
    );

    return Number(editorialScore.toFixed(4));
}

function ArticleCard({ article, intlLocale, t }) {
    const imageUrl = resolveImageUrl(article?.featured_image || '');
    const readingMinutes = estimateReadingMinutes(article);

    return (
        <article className="reader-portal-news-card rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Link to={`/reader/articles/${article.slug || article.id}`} className="reader-portal-news-card-media block h-40 bg-slate-100">
                <div className="h-full w-full">
                    {imageUrl ? (
                        <img src={imageUrl} alt={article?.featured_image_alt || article?.title || '-'} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                    )}
                </div>
            </Link>

            <div className="reader-portal-news-card-content p-3.5">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-blue-700 font-bold">
                        {article.category_name || '-'}
                    </p>
                    <p className="text-[10px] text-slate-500">{t('reader.home.minutesRead', '{count} menit baca', { count: readingMinutes })}</p>
                </div>

                <Link to={`/reader/articles/${article.slug || article.id}`} className="block mt-1">
                    <h3 className="reader-display text-[18px] leading-[1.2] font-semibold text-slate-900 line-clamp-2 hover:text-blue-700 transition-colors">
                        {article.title || '-'}
                    </h3>
                </Link>

                <p className="mt-1.5 text-[12px] leading-5 text-slate-500 line-clamp-2">{article.excerpt || t('reader.home.noExcerpt', 'Ringkasan belum tersedia.')}</p>

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 gap-2">
                    <span>{article.author_name || '-'}</span>
                    <span>{formatDate(article.date, intlLocale)}</span>
                </div>
            </div>
        </article>
    );
}

function SidebarPopularItem({ article, rank, intlLocale }) {
    return (
        <Link to={`/reader/articles/${article.slug || article.id}`} className="reader-portal-popular-item flex items-start gap-2.5">
            <span className="reader-portal-popular-rank inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                {rank}
            </span>
            <div className="min-w-0 flex-1 flex items-start gap-2">
                <div className="h-11 w-14 shrink-0 overflow-hidden rounded bg-slate-100">
                    {article.featured_image ? (
                        <img src={resolveImageUrl(article.featured_image)} alt={article.title || '-'} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-slate-800">{article.title || '-'}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatDate(article.date, intlLocale)}</p>
                </div>
            </div>
        </Link>
    );
}

export default function ReaderHomePage() {
    const { t, intlLocale } = useI18n();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [page, setPage] = useState(1);

    const [articles, setArticles] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        per_page: 9,
        current_page: 1,
        last_page: 1,
    });

    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsData, setInsightsData] = useState({
        generated_at: '',
        published_articles_total: 0,
        trending_articles: [],
        editors_picks: [],
    });
    const [activeTrendingIndex, setActiveTrendingIndex] = useState(0);

    useErrorNotification(error, setError);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setPage(1);
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    async function loadArticles(targetPage = page) {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                per_page: '9',
                q: search,
                category_id: categoryId,
            });

            const payload = await apiRequest(`/user/articles?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.home.errorLoad', 'Gagal memuat berita pembaca.'));
            }

            setArticles(payload?.data?.articles || []);
            setCategoryOptions(payload?.data?.filters?.category_options || []);
            setPagination(payload?.data?.pagination || {
                total: 0,
                per_page: 9,
                current_page: 1,
                last_page: 1,
            });
        } catch (err) {
            setError(err.message || t('reader.home.errorLoadDefault', 'Terjadi kesalahan saat memuat berita.'));
        } finally {
            setLoading(false);
        }
    }

    async function loadGlobalInsights() {
        const token = getToken();
        setInsightsLoading(true);

        try {
            const payload = await apiRequest('/user/articles/insights?trending_limit=5&picks_limit=4', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.home.errorLoadInsights', 'Gagal memuat insight berita.'));
            }

            setInsightsData({
                generated_at: String(payload?.data?.generated_at || ''),
                published_articles_total: Number(payload?.data?.published_articles_total || 0),
                trending_articles: payload?.data?.trending_articles || [],
                editors_picks: payload?.data?.editors_picks || [],
            });
        } catch (_) {
            setInsightsData((previous) => ({
                ...previous,
                trending_articles: previous.trending_articles || [],
                editors_picks: previous.editors_picks || [],
            }));
        } finally {
            setInsightsLoading(false);
        }
    }

    useEffect(() => {
        loadArticles(page);
    }, [page, search, categoryId]);

    useEffect(() => {
        loadGlobalInsights();
    }, []);

    const featuredArticle = useMemo(() => (articles.length ? articles[0] : null), [articles]);
    const latestArticles = useMemo(() => articles.slice(0, 6), [articles]);

    const insightCandidates = useMemo(() => {
        if (!articles.length) {
            return [];
        }

        const featuredId = featuredArticle?.id;
        const withoutFeatured = articles.filter((item) => item.id !== featuredId);
        return withoutFeatured.length ? withoutFeatured : articles;
    }, [articles, featuredArticle?.id]);

    const localTrendingArticles = useMemo(() => {
        return [...insightCandidates]
            .sort((left, right) => computeTrendingScore(right) - computeTrendingScore(left))
            .slice(0, 5);
    }, [insightCandidates]);

    const localEditorsPicks = useMemo(() => {
        const ranked = [...insightCandidates]
            .sort((left, right) => computeEditorsPickScore(right) - computeEditorsPickScore(left));

        const selected = [];
        const usedCategories = new Set();

        for (let index = 0; index < ranked.length; index += 1) {
            const item = ranked[index];
            const categoryName = String(item?.category_name || '').toLowerCase();

            if (!categoryName || !usedCategories.has(categoryName)) {
                selected.push(item);
                if (categoryName) {
                    usedCategories.add(categoryName);
                }
            }

            if (selected.length >= 4) {
                break;
            }
        }

        return selected.length ? selected : ranked.slice(0, 4);
    }, [insightCandidates]);

    const trendingArticles = useMemo(() => {
        const globalRows = insightsData?.trending_articles || [];
        return globalRows.length ? globalRows : localTrendingArticles;
    }, [insightsData?.trending_articles, localTrendingArticles]);

    const editorsPicks = useMemo(() => {
        const globalRows = insightsData?.editors_picks || [];
        return globalRows.length ? globalRows : localEditorsPicks;
    }, [insightsData?.editors_picks, localEditorsPicks]);

    const trendingSidebarItems = useMemo(() => trendingArticles.slice(0, 5), [trendingArticles]);

    const trendingSlideItems = useMemo(() => trendingArticles.slice(0, 5), [trendingArticles]);

    const heroArticle = useMemo(() => {
        if (trendingSlideItems.length) {
            return trendingSlideItems[activeTrendingIndex] || trendingSlideItems[0] || null;
        }

        return featuredArticle || null;
    }, [activeTrendingIndex, featuredArticle, trendingSlideItems]);

    useEffect(() => {
        setActiveTrendingIndex((previous) => {
            if (!trendingSlideItems.length) {
                return 0;
            }

            if (previous >= trendingSlideItems.length) {
                return 0;
            }

            return previous;
        });
    }, [trendingSlideItems.length]);

    useEffect(() => {
        if (trendingSlideItems.length <= 1) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            setActiveTrendingIndex((previous) => (previous + 1) % trendingSlideItems.length);
        }, 6500);

        return () => window.clearInterval(timer);
    }, [trendingSlideItems.length]);

    function showPrevTrendingSlide() {
        if (trendingSlideItems.length <= 1) {
            return;
        }

        setActiveTrendingIndex((previous) => (previous - 1 + trendingSlideItems.length) % trendingSlideItems.length);
    }

    function showNextTrendingSlide() {
        if (trendingSlideItems.length <= 1) {
            return;
        }

        setActiveTrendingIndex((previous) => (previous + 1) % trendingSlideItems.length);
    }

    const popularSidebarItems = useMemo(() => {
        const source = editorsPicks.length ? editorsPicks : trendingArticles;
        return source.slice(0, 5);
    }, [editorsPicks, trendingArticles]);

    const homeTopics = useMemo(() => {
        const mapped = categoryOptions.map((category) => ({
            id: String(category.id),
            name: category.name,
        }));

        return [
            { id: '', name: t('reader.home.topicHome', 'Beranda') },
            ...mapped,
        ];
    }, [categoryOptions, t]);

    const footerCategories = useMemo(() => categoryOptions.slice(0, 4), [categoryOptions]);

    return (
        <ReaderShell shellClassName="reader-shell-news-portal reader-shell-news-portal-home">
            <div className="reader-home-portal">
                <section className="reader-home-portal-top-nav rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-2 items-center">
                        <div className="reader-home-portal-topics flex items-center gap-1.5 overflow-x-auto">
                            {homeTopics.map((topic) => (
                                <button
                                    key={`${topic.id || 'home'}-${topic.name}`}
                                    type="button"
                                    onClick={() => {
                                        setPage(1);
                                        setCategoryId(topic.id);
                                    }}
                                    className={`reader-home-portal-topic-link ${String(categoryId) === String(topic.id) ? 'is-active' : ''}`}
                                >
                                    {topic.name}
                                </button>
                            ))}
                        </div>

                        <div className="reader-home-portal-search-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="reader-home-portal-search-icon h-4 w-4">
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.8-3.8" />
                            </svg>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder={t('reader.home.searchShort', 'Cari berita')}
                                className="reader-home-portal-search-input"
                            />
                        </div>
                    </div>
                </section>

                <section className="mt-4">
                    {loading ? (
                        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                            {t('common.loadingData', 'Memuat data...')}
                        </article>
                    ) : heroArticle ? (
                        <div className="space-y-5">
                            <div className="reader-home-portal-hero-grid grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-4">
                                <article className="reader-home-portal-hero-card relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                    <Link to={`/reader/articles/${heroArticle.slug || heroArticle.id}`} className="reader-home-portal-hero-media block h-[340px] sm:h-[380px]">
                                        {heroArticle.featured_image ? (
                                            <img
                                                src={resolveImageUrl(heroArticle.featured_image)}
                                                alt={heroArticle.featured_image_alt || heroArticle.title || '-'}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-100 to-slate-200" />
                                        )}
                                        <div className="reader-home-portal-hero-overlay">
                                            <p className="reader-home-portal-hero-tag">{t('reader.home.trendingWeeklyLabel', 'Top Trending Mingguan')}</p>
                                            <h2 className="reader-display mt-2 text-3xl leading-tight font-semibold text-white sm:text-[38px]">{heroArticle.title || '-'}</h2>
                                            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90">{heroArticle.excerpt || t('reader.home.noExcerpt', 'Ringkasan belum tersedia.')}</p>
                                            <span className="reader-home-portal-hero-cta mt-4 inline-flex items-center rounded-md px-3 py-2 text-xs font-semibold">
                                                {t('reader.home.readMore', 'Baca Selengkapnya')}
                                            </span>
                                        </div>
                                    </Link>

                                    {trendingSlideItems.length > 1 ? (
                                        <>
                                            <div className="reader-home-portal-hero-nav absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-2.5">
                                                <button
                                                    type="button"
                                                    onClick={showPrevTrendingSlide}
                                                    className="reader-home-portal-hero-nav-btn"
                                                    aria-label={t('reader.home.prevSlide', 'Berita sebelumnya')}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                                        <path d="m15 18-6-6 6-6" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={showNextTrendingSlide}
                                                    className="reader-home-portal-hero-nav-btn"
                                                    aria-label={t('reader.home.nextSlide', 'Berita selanjutnya')}
                                                >
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                                        <path d="m9 6 6 6-6 6" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <div className="reader-home-portal-hero-dots absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
                                                {trendingSlideItems.map((item, index) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setActiveTrendingIndex(index)}
                                                        className={`reader-home-portal-hero-dot ${index === activeTrendingIndex ? 'is-active' : ''}`}
                                                        aria-label={t('reader.home.slideTo', 'Buka slide {index}', { index: index + 1 })}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : null}
                                </article>

                                <aside className="reader-home-portal-trending rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                                    <div className="mb-2.5 flex items-center justify-between gap-2">
                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('reader.home.trendingTitle', 'Trending')}</h3>
                                        {insightsLoading ? <span className="text-[10px] text-slate-400">{t('reader.home.updating', 'Memuat...')}</span> : null}
                                    </div>

                                    <div className="space-y-2.5">
                                        {trendingSidebarItems.length ? trendingSidebarItems.map((article, index) => (
                                            <Link key={article.id} to={`/reader/articles/${article.slug || article.id}`} className="reader-home-portal-trending-item flex items-start gap-2.5">
                                                <span className="reader-home-portal-trending-rank inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-slate-800">{article.title || '-'}</p>
                                                    <p className="mt-1 text-[10px] text-slate-400">{formatDate(article.date, intlLocale)}</p>
                                                </div>
                                            </Link>
                                        )) : (
                                            <p className="text-xs text-slate-400">{t('reader.home.trendingEmpty', 'Belum cukup data trending.')}</p>
                                        )}
                                    </div>
                                </aside>
                            </div>

                            <div className="reader-home-portal-content-grid grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] gap-4">
                                <section>
                                    <div className="mb-2.5 border-b border-slate-200 pb-1.5">
                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('reader.home.latestNews', 'Berita Terbaru')}</h3>
                                    </div>

                                    {latestArticles.length ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {latestArticles.map((article) => (
                                                <ArticleCard
                                                    key={article.id}
                                                    article={article}
                                                    intlLocale={intlLocale}
                                                    t={t}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                                            {t('reader.home.emptySecondary', 'Belum ada berita tambahan di halaman ini.')}
                                        </article>
                                    )}
                                </section>

                                <aside className="space-y-3">
                                    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('reader.home.popularNews', 'Berita Populer')}</h3>
                                        <div className="mt-2.5 space-y-2.5">
                                            {popularSidebarItems.length ? popularSidebarItems.map((article, index) => (
                                                <SidebarPopularItem
                                                    key={`${article.id}-${index}`}
                                                    article={article}
                                                    rank={index + 1}
                                                    intlLocale={intlLocale}
                                                />
                                            )) : (
                                                <p className="text-xs text-slate-400">{t('reader.home.editorPicksEmpty', 'Belum ada berita populer saat ini.')}</p>
                                            )}
                                        </div>
                                    </section>

                                    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                                        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('reader.home.categories', 'Kategori')}</h3>
                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {footerCategories.length ? footerCategories.map((category) => (
                                                <button
                                                    key={category.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setPage(1);
                                                        setCategoryId(String(category.id));
                                                    }}
                                                    className={`reader-home-portal-category-chip ${String(categoryId) === String(category.id) ? 'is-active' : ''}`}
                                                >
                                                    {category.name}
                                                </button>
                                            )) : (
                                                <span className="text-xs text-slate-400">{t('reader.home.allCategories', 'Semua kategori')}</span>
                                            )}
                                        </div>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    ) : (
                        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                            {t('reader.home.empty', 'Belum ada berita publikasi untuk ditampilkan.')}
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
            </div>
        </ReaderShell>
    );
}
