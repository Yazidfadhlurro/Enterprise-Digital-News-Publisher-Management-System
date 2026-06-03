import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { normalizeRichText, sanitizeHtml, stripHtml } from '../../lib/html';
import { useI18n } from '../../lib/i18n';
import { articleImageUrl } from '../../lib/media';
import { useErrorNotification } from '../../lib/notify';

function formatDate(value, localeTag) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(localeTag || 'id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function AdminArticleDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [article, setArticle] = useState(null);
    const [imageFailed, setImageFailed] = useState(false);

    useErrorNotification(error, setError);

    useEffect(() => {
        async function loadDetail() {
            const token = getToken();
            setLoading(true);
            setError('');
            try {
                const payload = await apiRequest(`/admin/articles/${id}`, { token });
                if (payload?.status !== 'success') throw new Error(payload?.message || 'Gagal memuat detail artikel.');
                setArticle(payload?.data?.article || null);
                setImageFailed(false);
            } catch (err) {
                setError(err.message || 'Terjadi kesalahan saat memuat detail artikel.');
            } finally {
                setLoading(false);
            }
        }
        loadDetail();
    }, [id]);

    const normalizedContent = useMemo(() => normalizeRichText(article?.content), [article?.content]);
    const sanitizedContent = useMemo(() => sanitizeHtml(normalizedContent), [normalizedContent]);
    const contentText = useMemo(() => stripHtml(normalizedContent), [normalizedContent]);
    const hasContent = contentText.trim().length > 0;
    const articleImageSrc = articleImageUrl(article);

    return (
        <AdminShell title={t('admin.articles.panelDetailTitle', 'Detail Artikel')}>
            <div className="mb-3">
                <button type="button" className="portal-btn portal-btn-secondary portal-btn-sm" onClick={() => navigate('/admin/articles')}>
                    ← {t('common.back', 'Kembali')}
                </button>
            </div>

            {loading ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                    {t('common.loadingData', 'Memuat data...')}
                </section>
            ) : article ? (
                <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm min-w-0" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                    <p className="text-xs uppercase tracking-[0.12em] text-blue-700 font-semibold">{article.category_name || '-'}</p>
                    <h2 className="text-xl md:text-2xl leading-snug font-semibold text-slate-900 mt-2">{article.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{article.excerpt || t('editor.reviewDetail.noSummary', 'Tidak ada ringkasan berita.')}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{t('table.author', 'Penulis')}: <strong className="text-slate-700">{article.author_name || '-'}</strong></span>
                        <span>{t('table.date', 'Tanggal')}: <strong className="text-slate-700">{formatDate(article.published_at || article.created_at, intlLocale)}</strong></span>
                        <span>{t('table.status', 'Status')}: <strong className="text-slate-700">{article.status || '-'}</strong></span>
                        {article.is_featured && (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">★ Unggulan</span>
                        )}
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                        {articleImageSrc && !imageFailed ? (
                            <img
                                src={articleImageSrc}
                                alt={article.title}
                                className="w-full h-[360px] object-cover"
                                onError={() => setImageFailed(true)}
                            />
                        ) : (
                            <div className="w-full h-[360px] bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 flex flex-col items-center justify-center text-slate-500">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8">
                                    <rect x="3.5" y="4" width="17" height="16" rx="2" />
                                    <path d="m3.5 15 5-5 4 4 3-3 5 5" />
                                    <circle cx="9" cy="8" r="1.4" />
                                </svg>
                                <p className="mt-2 text-sm font-medium">{t('editor.reviewDetail.imageUnavailable', 'Gambar belum tersedia')}</p>
                            </div>
                        )}
                    </div>

                    <div className="editor-review-content mt-5 text-[16px] leading-8 text-slate-700 break-words overflow-hidden">
                        {hasContent ? (
                            <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
                        ) : (
                            <p>{t('editor.reviewDetail.noContent', 'Tidak ada konten untuk ditampilkan.')}</p>
                        )}
                    </div>
                </article>
            ) : (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                    {t('editor.reviewDetail.notFound', 'Detail artikel tidak ditemukan.')}
                </section>
            )}
        </AdminShell>
    );
}
