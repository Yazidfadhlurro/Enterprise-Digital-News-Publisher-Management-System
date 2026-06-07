import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthorShell from '../../components/AuthorShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { normalizeRichText, sanitizeHtml, stripHtml } from '../../lib/html';
import { useI18n } from '../../lib/i18n';
import { articleImageUrl } from '../../lib/media';
import { useErrorNotification } from '../../lib/notify';

function formatDateTime(value, localeTag) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(localeTag || 'id-ID', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AuthorArticleViewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [article, setArticle] = useState(null);
    const [comments, setComments] = useState([]);
    const [imageFailed, setImageFailed] = useState(false);

    useErrorNotification(error, setError);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const payload = await apiRequest(`/author/articles/${id}`, { token: getToken() });
                if (payload?.status !== 'success') throw new Error(payload?.message);
                setArticle(payload.data?.article || null);
                setComments(payload.data?.comments || []);
            } catch (err) {
                setError(err.message || 'Gagal memuat artikel.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const normalizedContent = useMemo(() => normalizeRichText(article?.content), [article?.content]);
    const sanitizedContent = useMemo(() => sanitizeHtml(normalizedContent), [normalizedContent]);
    const hasContent = stripHtml(normalizedContent).trim().length > 0;
    const coverImage = articleImageUrl(article);

    return (
        <AuthorShell title={t('author.articles.view', 'Detail Artikel')}>
            <div className="mb-3">
                <button type="button" className="portal-btn portal-btn-secondary portal-btn-sm" onClick={() => navigate('/author/articles')}>
                    ← {t('common.back', 'Kembali')}
                </button>
            </div>

            {loading ? (
                <p className="text-sm text-slate-500 p-4">{t('common.loadingData', 'Memuat data...')}</p>
            ) : article ? (
                <div className="space-y-4">
                    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">{article.category_name || '-'}</p>
                        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mt-2 leading-snug">{article.title}</h2>
                        {article.excerpt ? <p className="mt-3 text-slate-600 leading-relaxed">{article.excerpt}</p> : null}

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>★ {Number(article.average_rating || 0).toFixed(1)} ({article.ratings_total || 0} rating)</span>
                            <span>{article.views_count || 0} tayangan</span>
                        </div>

                        <div className="mt-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-[320px] md:h-[420px]">
                            {coverImage && !imageFailed ? (
                                <img src={coverImage} alt={article.featured_image_alt || article.title} className="w-full h-full object-cover" onError={() => setImageFailed(true)} />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                            )}
                        </div>

                        <div className="editor-review-content mt-6 text-slate-700 text-base leading-8">
                            {hasContent ? (
                                <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
                            ) : (
                                <p className="text-slate-400">{t('editor.reviewDetail.noContent', 'Tidak ada konten.')}</p>
                            )}
                        </div>
                    </article>

                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">
                            {t('reader.detail.commentsTitle', 'Komentar')} ({comments.length})
                        </h3>
                        {comments.length ? (
                            <div className="space-y-2 max-h-96 overflow-auto">
                                {comments.map((c) => (
                                    <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-semibold text-slate-700">{c.commenter_name}</span>
                                            <span className="text-slate-400">{formatDateTime(c.created_at, intlLocale)}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">{c.content}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">{t('reader.detail.commentsEmpty', 'Belum ada komentar.')}</p>
                        )}
                    </section>
                </div>
            ) : (
                <p className="text-sm text-slate-500 p-4">{t('editor.reviewDetail.notFound', 'Artikel tidak ditemukan.')}</p>
            )}
        </AuthorShell>
    );
}
