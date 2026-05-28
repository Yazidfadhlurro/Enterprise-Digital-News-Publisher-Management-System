import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReaderShell from '../../components/ReaderShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { normalizeRichText, sanitizeHtml, stripHtml } from '../../lib/html';
import { useI18n } from '../../lib/i18n';
import { articleImageUrl } from '../../lib/media';
import { useErrorNotification, useNotify } from '../../lib/notify';

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

function StarButton({ active, onClick, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            className={`reader-star-btn w-8 h-8 rounded-md border flex items-center justify-center transition ${active ? 'is-active border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-400 hover:text-amber-600 hover:border-amber-300'}`}
        >
            ★
        </button>
    );
}

export default function ReaderArticleDetailPage() {
    const { identifier } = useParams();
    const notify = useNotify();
    const { t, intlLocale } = useI18n();

    const [loading, setLoading] = useState(true);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [bookmarkSubmitting, setBookmarkSubmitting] = useState(false);
    const [ratingSubmitting, setRatingSubmitting] = useState(false);
    const [commentSubmitting, setCommentSubmitting] = useState(false);

    const [error, setError] = useState('');
    const [article, setArticle] = useState(null);
    const [relatedArticles, setRelatedArticles] = useState([]);
    const [comments, setComments] = useState([]);
    const [ratingValue, setRatingValue] = useState(0);
    const [commentInput, setCommentInput] = useState('');

    useErrorNotification(error, setError);

    async function loadDetail() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest(`/user/articles/${identifier}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.detail.errorLoad', 'Gagal memuat detail berita.'));
            }

            const detailArticle = payload?.data?.article || null;
            setArticle(detailArticle);
            setRelatedArticles(payload?.data?.related_articles || []);
            setRatingValue(Number(detailArticle?.current_user_rating || 0));
        } catch (err) {
            setError(err.message || t('reader.detail.errorLoadDefault', 'Terjadi kesalahan saat memuat detail berita.'));
        } finally {
            setLoading(false);
        }
    }

    async function loadComments() {
        const token = getToken();
        setCommentsLoading(true);
        setError('');

        try {
            const payload = await apiRequest(`/user/articles/${identifier}/comments?per_page=20`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.detail.errorLoadComments', 'Gagal memuat komentar berita.'));
            }

            setComments(payload?.data?.comments || []);
        } catch (err) {
            setError(err.message || t('reader.detail.errorLoadCommentsDefault', 'Terjadi kesalahan saat memuat komentar.'));
        } finally {
            setCommentsLoading(false);
        }
    }

    useEffect(() => {
        loadDetail();
        loadComments();
    }, [identifier]);

    async function toggleBookmark() {
        if (!article || bookmarkSubmitting) {
            return;
        }

        const token = getToken();
        setBookmarkSubmitting(true);
        setError('');

        try {
            const payload = await apiRequest(`/user/articles/${article.id}/bookmark`, {
                method: 'POST',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.detail.errorBookmark', 'Gagal memperbarui bookmark.'));
            }

            const bookmarked = Boolean(payload?.data?.bookmarked);
            setArticle((previous) => {
                if (!previous) {
                    return previous;
                }

                return {
                    ...previous,
                    bookmarked,
                };
            });

            notify.success(bookmarked
                ? t('reader.detail.bookmarkSaved', 'Berita disimpan ke bookmark.')
                : t('reader.detail.bookmarkRemoved', 'Berita dihapus dari bookmark.'));
        } catch (err) {
            setError(err.message || t('reader.detail.errorBookmarkDefault', 'Terjadi kesalahan saat menyimpan bookmark.'));
        } finally {
            setBookmarkSubmitting(false);
        }
    }

    async function submitRating() {
        if (!article || ratingSubmitting || ratingValue < 1 || ratingValue > 5) {
            return;
        }

        const token = getToken();
        setRatingSubmitting(true);
        setError('');

        try {
            const payload = await apiRequest(`/user/articles/${article.id}/rating`, {
                method: 'POST',
                token,
                body: {
                    rating: ratingValue,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.detail.errorRating', 'Gagal menyimpan rating.'));
            }

            setArticle((previous) => {
                if (!previous) {
                    return previous;
                }

                return {
                    ...previous,
                    current_user_rating: Number(payload?.data?.current_user_rating || ratingValue),
                    ratings_total: Number(payload?.data?.ratings_total || previous.ratings_total || 0),
                    average_rating: Number(payload?.data?.average_rating || previous.average_rating || 0),
                };
            });

            notify.success(t('reader.detail.ratingSaved', 'Rating berhasil disimpan.'));
        } catch (err) {
            setError(err.message || t('reader.detail.errorRatingDefault', 'Terjadi kesalahan saat menyimpan rating.'));
        } finally {
            setRatingSubmitting(false);
        }
    }

    async function submitComment(event) {
        event.preventDefault();

        const cleanComment = commentInput.trim();
        if (!cleanComment) {
            return;
        }

        if (!article || commentSubmitting) {
            return;
        }

        const token = getToken();
        setCommentSubmitting(true);
        setError('');

        try {
            const payload = await apiRequest(`/user/articles/${article.id}/comments`, {
                method: 'POST',
                token,
                body: {
                    content: cleanComment,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('reader.detail.errorComment', 'Gagal mengirim komentar.'));
            }

            setCommentInput('');
            notify.info(t('reader.detail.commentQueued', 'Komentar terkirim dan menunggu moderasi.'));
            await loadComments();
        } catch (err) {
            setError(err.message || t('reader.detail.errorCommentDefault', 'Terjadi kesalahan saat mengirim komentar.'));
        } finally {
            setCommentSubmitting(false);
        }
    }

    const normalizedContent = useMemo(() => normalizeRichText(article?.content), [article?.content]);
    const sanitizedContent = useMemo(() => sanitizeHtml(normalizedContent), [normalizedContent]);
    const contentText = useMemo(() => stripHtml(normalizedContent), [normalizedContent]);
    const hasContent = contentText.trim().length > 0;
    const coverImage = articleImageUrl(article);
    const estimatedReadMinutes = useMemo(() => {
        const words = contentText.split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 190));
    }, [contentText]);

    return (
        <ReaderShell
            shellClassName="reader-shell-news-portal reader-shell-news-portal-article"
        >
            {loading ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                    {t('common.loadingData', 'Memuat data...')}
                </section>
            ) : article ? (
                <div className="reader-detail-layout grid grid-cols-1 gap-4 items-start xl:grid-cols-[minmax(0,820px)_320px] xl:justify-center">
                    <article className="reader-detail-article rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <p className="reader-eyebrow text-xs uppercase tracking-[0.12em] text-blue-700 font-semibold">{article.category_name || '-'}</p>
                        <h2 className="reader-detail-title reader-display mt-2 text-3xl md:text-5xl leading-[1.05] font-semibold text-slate-900">{article.title}</h2>
                        <p className="reader-detail-excerpt mt-3 text-slate-600">{article.excerpt || t('reader.detail.noExcerpt', 'Ringkasan belum tersedia.')}</p>

                        <div className="reader-detail-meta mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="reader-detail-meta-chip">{article.author_name || '-'}</span>
                            <span className="reader-detail-meta-chip">{formatDateTime(article.date, intlLocale)}</span>
                            <span className="reader-detail-meta-chip">{t('reader.detail.views', '{count} tayangan', { count: Number(article.views_count || 0) })}</span>
                            <span className="reader-detail-meta-chip">{t('reader.home.minutesRead', '{count} menit baca', { count: estimatedReadMinutes })}</span>
                        </div>

                        <div className="reader-detail-cover mt-5 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 h-[380px] md:h-[440px]">
                            {coverImage ? (
                                <img src={coverImage} alt={article.featured_image_alt || article.title} className="w-full h-full object-cover" decoding="async" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                            )}
                        </div>

                        <div className="reader-detail-content mt-6 text-slate-700">
                            {hasContent ? (
                                <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
                            ) : (
                                <p>{t('reader.detail.noContent', 'Konten berita tidak tersedia.')}</p>
                            )}
                        </div>

                        {article.tags?.length ? (
                            <div className="reader-detail-tags mt-6 flex flex-wrap gap-2">
                                {article.tags.map((tag) => (
                                    <span key={tag.id} className="reader-tag-pill rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                                        #{tag.name}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </article>

                    <aside className="reader-detail-aside space-y-4 xl:sticky xl:top-20">
                        <section className="reader-detail-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-slate-500">{t('reader.detail.interaction', 'Interaksi')}</p>

                            <button
                                type="button"
                                onClick={toggleBookmark}
                                disabled={bookmarkSubmitting}
                                className={`reader-detail-action mt-3 w-full rounded-md border px-3 py-2.5 text-sm font-semibold ${article.bookmarked ? 'is-active border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
                            >
                                {article.bookmarked
                                    ? t('reader.detail.bookmarked', 'Tersimpan di Bookmark')
                                    : t('reader.detail.saveBookmark', 'Simpan ke Bookmark')}
                            </button>

                            <p className="mt-4 text-xs text-slate-500">{t('reader.detail.rating', 'Rating Anda')}</p>
                            <div className="mt-2 flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <StarButton
                                        key={value}
                                        active={value <= ratingValue}
                                        onClick={() => setRatingValue(value)}
                                        label={t('reader.detail.starLabel', '{value} bintang', { value })}
                                    />
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={submitRating}
                                disabled={ratingSubmitting || ratingValue < 1}
                                className="portal-btn portal-btn-primary mt-3 w-full"
                            >
                                {ratingSubmitting ? t('common.processing', 'Memproses...') : t('reader.detail.saveRating', 'Simpan Rating')}
                            </button>

                            <p className="mt-3 text-xs text-slate-500">
                                {t('reader.detail.ratingSummary', 'Rata-rata {avg} dari {count} rating', {
                                    avg: Number(article.average_rating || 0).toFixed(2),
                                    count: Number(article.ratings_total || 0),
                                })}
                            </p>
                        </section>

                        <section className="reader-detail-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-slate-500">{t('reader.detail.commentsTitle', 'Komentar')}</p>

                            <form className="mt-3" onSubmit={submitComment}>
                                <textarea
                                    value={commentInput}
                                    onChange={(event) => setCommentInput(event.target.value.slice(0, 1000))}
                                    placeholder={t('reader.detail.commentPlaceholder', 'Tulis komentar Anda...')}
                                    rows={4}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    disabled={commentSubmitting}
                                />
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-slate-400">{t('reader.detail.commentCounter', '{count}/1000 karakter', { count: commentInput.length })}</p>
                                    <button
                                        type="submit"
                                        disabled={commentSubmitting || !commentInput.trim()}
                                        className="portal-btn portal-btn-primary portal-btn-sm"
                                    >
                                        {commentSubmitting ? t('common.processing', 'Memproses...') : t('reader.detail.sendComment', 'Kirim')}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-4 max-h-80 overflow-auto space-y-2">
                                {commentsLoading ? (
                                    <p className="text-sm text-slate-400">{t('common.loadingData', 'Memuat data...')}</p>
                                ) : comments.length ? (
                                    comments.map((comment) => (
                                        <article key={comment.id} className="reader-comment-card rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <p className="font-semibold text-slate-700">{comment.commenter_name || 'Pembaca'}</p>
                                                <p className="text-slate-400">{formatDateTime(comment.created_at, intlLocale)}</p>
                                            </div>
                                            <p className="mt-1.5 text-sm text-slate-600 leading-6">{comment.content}</p>
                                            {comment.is_pending ? (
                                                <p className="mt-1 text-[11px] font-semibold text-amber-700">{t('reader.detail.commentPending', 'Menunggu moderasi')}</p>
                                            ) : null}
                                        </article>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-400">{t('reader.detail.commentsEmpty', 'Belum ada komentar.')}</p>
                                )}
                            </div>
                        </section>
                    </aside>
                </div>
            ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                    {t('reader.detail.notFound', 'Berita tidak ditemukan.')}
                </section>
            )}

            {relatedArticles.length ? (
                <section className="mt-5">
                    <h3 className="reader-display text-2xl font-semibold text-slate-900">{t('reader.detail.relatedTitle', 'Berita Terkait')}</h3>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {relatedArticles.map((item) => {
                            const relatedReadingMinutes = estimateReadMinutesFromSnippet(item.title, item.excerpt);

                            return (
                                <Link key={item.id} to={`/reader/articles/${item.slug || item.id}`} className="reader-related-card rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="h-28 bg-slate-100">
                                    {item.featured_image ? (
                                        <img src={articleImageUrl(item)} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                                    )}
                                </div>
                                <div className="p-3">
                                    <p className="text-[10px] uppercase tracking-[0.12em] text-blue-700 font-semibold">{item.category_name || '-'}</p>
                                    <p className="reader-display mt-1 text-lg font-semibold text-slate-900 line-clamp-2">{item.title}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{t('reader.home.minutesRead', '{count} menit baca', { count: relatedReadingMinutes })}</p>
                                </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            ) : null}
        </ReaderShell>
    );
}

function estimateReadMinutesFromSnippet(title, excerpt) {
    const source = `${title || ''} ${excerpt || ''}`.trim();
    if (!source) {
        return 1;
    }

    const words = source.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 180));
}
