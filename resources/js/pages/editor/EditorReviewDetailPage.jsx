import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EditorShell from '../../components/EditorShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { normalizeRichText, sanitizeHtml, stripHtml } from '../../lib/html';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

const REVIEW_NOTES_LIMIT = 500;

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

export default function EditorReviewDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [submittingAction, setSubmittingAction] = useState('');
    const [error, setError] = useState('');
    const [article, setArticle] = useState(null);
    const [reviewChecklist, setReviewChecklist] = useState(null);
    const [revisionDiff, setRevisionDiff] = useState(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [imageFailed, setImageFailed] = useState(false);

    useErrorNotification(error, setError);

    async function loadDetail() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest(`/reviewer/articles/${id}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('editor.reviewDetail.errorLoad', 'Gagal memuat detail berita review.'));
            }

            const nextArticle = payload?.data?.article || null;
            setArticle(nextArticle);
            setReviewChecklist(payload?.data?.review_checklist || null);
            setRevisionDiff(payload?.data?.revision_diff || null);
            setReviewNotes(nextArticle?.review_notes || '');
            setImageFailed(false);
        } catch (err) {
            setError(err.message || t('editor.reviewDetail.errorLoadDefault', 'Terjadi kesalahan saat memuat detail berita review.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDetail();
    }, [id]);

    const articleImageUrl = resolveImageUrl(article?.featured_image);
    const normalizedContent = useMemo(() => normalizeRichText(article?.content), [article?.content]);
    const sanitizedContent = useMemo(() => sanitizeHtml(normalizedContent), [normalizedContent]);
    const contentText = useMemo(() => stripHtml(normalizedContent), [normalizedContent]);
    const hasContent = contentText.trim().length > 0;
    const checklistItems = reviewChecklist?.items || [];
    const checklistAllPassed = Boolean(reviewChecklist?.all_passed);
    const changedFields = useMemo(
        () => (revisionDiff?.changes || []).filter((item) => item?.changed),
        [revisionDiff]
    );

    async function submitDecision(type) {
        if (!article) return;

        if (type === 'reject' && !reviewNotes.trim()) {
            setError(t('editor.reviewDetail.rejectNoteRequired', 'Isi catatan revisi terlebih dahulu agar penulis tahu apa yang perlu diperbaiki.'));
            return;
        }

        if (type === 'approve' && !checklistAllPassed && !reviewNotes.trim()) {
            setError(t('editor.reviewDetail.checklistNotPassed', 'Checklist belum lengkap. Isi catatan sebagai justifikasi untuk tetap mempublikasikan.'));
            return;
        }

        const token = getToken();
        const endpoint = type === 'approve' ? `/reviewer/articles/${id}/approve` : `/reviewer/articles/${id}/reject`;

        setSubmittingAction(type);
        setError('');

        try {
            const payload = await apiRequest(endpoint, {
                method: 'POST',
                token,
                body: {
                    review_notes: reviewNotes.trim() || null,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('editor.reviewDetail.errorProcess', 'Gagal memproses berita review.'));
            }

            navigate('/editor/review', { replace: true });
        } catch (err) {
            setError(err.message || t('editor.reviewDetail.errorProcessDefault', 'Terjadi kesalahan saat memproses berita review.'));
        } finally {
            setSubmittingAction('');
        }
    }

    return (
        <EditorShell title={t('editor.reviewDetail.title', 'Review Berita')}>
            {loading ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                    {t('editor.reviewDetail.loading', 'Memuat detail berita review...')}
                </section>
            ) : article ? (
                <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_290px] gap-4 items-start">
                    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
                        <h2 className="text-[34px] md:text-[42px] leading-[1.08] font-semibold text-slate-900">{t(dynamicKey('editor.reviewDetail.articleTitle', article.title), article.title)}</h2>
                        <p className="mt-4 text-[18px] leading-8 text-slate-600">{article.excerpt ? t(dynamicKey('editor.reviewDetail.articleExcerpt', article.excerpt), article.excerpt) : t('editor.reviewDetail.noSummary', 'Tidak ada ringkasan berita.')}</p>

                        <div className="mt-5 rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                            {articleImageUrl && !imageFailed ? (
                                <img
                                    src={articleImageUrl}
                                    alt={t(dynamicKey('editor.reviewDetail.articleAlt', article.title), article.title)}
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
                                    <p className="mt-2 text-sm font-medium">{t('editor.reviewDetail.imageUnavailable', 'Gambar berita belum tersedia')}</p>
                                </div>
                            )}
                        </div>

                        <div className="editor-review-content mt-5 text-[16px] leading-8 text-slate-700">
                            {hasContent ? (
                                <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
                            ) : (
                                <p>{t('editor.reviewDetail.noContent', 'Tidak ada konten berita untuk ditampilkan.')}</p>
                            )}
                        </div>
                    </article>

                    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4">
                        <h3 className="text-lg font-semibold text-slate-900">{t('editor.reviewDetail.reviewPanel', 'Panel Review')}</h3>

                        <div className="mt-4 space-y-1 text-sm">
                            <p className="text-slate-500">{t('table.author', 'Penulis')}: <span className="text-slate-700 font-medium">{t(dynamicKey('editor.reviewDetail.authorName', article.author_name), article.author_name)}</span></p>
                            <p className="text-slate-500">{t('editor.review.submittedAt', 'Dikirim')}: <span className="text-slate-700 font-medium">{formatDate(article.submitted_at, intlLocale)}</span></p>
                            <p className="text-slate-500">{t('editor.review.priority', 'Prioritas')}: <span className="text-slate-700 font-medium">{article.priority_score ?? 50}</span></p>
                            <p className="text-slate-500">{t('editor.review.due', 'Tenggat Review')}: <span className="text-slate-700 font-medium">{formatDate(article.review_due_at, intlLocale)}</span></p>
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('editor.reviewDetail.checklistTitle', 'Checklist Pra-Publikasi')}</p>
                            <ul className="mt-2 space-y-1.5">
                                {checklistItems.map((item) => (
                                    <li key={item.key} className="flex items-start gap-2 text-xs">
                                        <span className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ${item.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {item.passed ? '✓' : '!'}
                                        </span>
                                        <span className={item.passed ? 'text-slate-600' : 'text-rose-700 font-medium'}>{item.label}</span>
                                    </li>
                                ))}
                            </ul>
                            {!checklistAllPassed ? (
                                <p className="mt-2 text-[11px] font-semibold text-rose-700">{t('editor.reviewDetail.checklistAlert', 'Ada item wajib yang belum terpenuhi.')}</p>
                            ) : (
                                <p className="mt-2 text-[11px] font-semibold text-emerald-700">{t('editor.reviewDetail.checklistReady', 'Checklist lengkap, artikel siap dipublikasikan.')}</p>
                            )}
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('editor.reviewDetail.diffTitle', 'Ringkasan Perubahan')}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {t('editor.reviewDetail.diffSummary', '{count} field berubah', { count: changedFields.length })}
                            </p>
                            <div className="mt-2 max-h-36 overflow-auto space-y-1">
                                {changedFields.length ? (
                                    changedFields.map((item) => (
                                        <div key={item.field} className="rounded border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                                            <span className="font-semibold">{item.field}</span>
                                            {' '}diperbarui
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400">{t('editor.reviewDetail.diffEmpty', 'Belum ada perubahan versi untuk dibandingkan.')}</p>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            className="portal-btn portal-btn-success mt-4 w-full"
                            onClick={() => submitDecision('approve')}
                            disabled={submittingAction !== ''}
                        >
                            {submittingAction === 'approve' ? t('common.processing', 'Memproses...') : t('editor.reviewDetail.approvePublish', 'Setujui & Publikasikan')}
                        </button>
                        {!checklistAllPassed && (
                            <p className="mt-1 text-[11px] text-amber-600">Checklist belum lengkap — isi catatan jika ingin tetap mempublikasikan.</p>
                        )}

                        <button
                            type="button"
                            className="portal-btn portal-btn-danger mt-2 w-full"
                            onClick={() => submitDecision('reject')}
                            disabled={submittingAction !== ''}
                        >
                            {submittingAction === 'reject' ? t('common.processing', 'Memproses...') : t('editor.reviewDetail.returnToAuthor', 'Kembalikan ke Penulis')}
                        </button>
                        <p className="mt-1 text-[11px] text-slate-400">Catatan revisi wajib diisi saat mengembalikan ke penulis.</p>

                        <div className="mt-4">
                            <label htmlFor="review_notes" className="block text-sm font-semibold text-slate-700 mb-1">{t('editor.reviewDetail.revisionNotes', 'Catatan Revisi')}</label>
                            <textarea
                                id="review_notes"
                                value={reviewNotes}
                                onChange={(event) => setReviewNotes(event.target.value.slice(0, REVIEW_NOTES_LIMIT))}
                                placeholder={t('editor.reviewDetail.revisionPlaceholder', 'Tuliskan alasan dan panduan revisi...')}
                                rows={5}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
                                disabled={submittingAction !== ''}
                            />
                            <p className="mt-2 text-xs text-slate-400">{t('editor.reviewDetail.characterCount', '{count} / {max} karakter', { count: reviewNotes.length, max: REVIEW_NOTES_LIMIT })}</p>
                        </div>
                    </aside>
                </section>
            ) : (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-500">
                    {t('editor.reviewDetail.notFound', 'Detail berita tidak ditemukan.')}
                </section>
            )}
        </EditorShell>
    );
}
