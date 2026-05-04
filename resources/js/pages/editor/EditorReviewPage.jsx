import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EditorShell from '../../components/EditorShell';
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

export default function EditorReviewPage() {
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
            const payload = await apiRequest('/reviewer/articles?status=review&per_page=20', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('editor.review.errorLoad', 'Gagal memuat berita review.'));
            }

            setArticles(payload?.data?.articles || []);
            setTotal(payload?.data?.pagination?.total || 0);
        } catch (err) {
            setError(err.message || t('editor.review.errorLoadDefault', 'Terjadi kesalahan saat memuat berita review.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadArticles();
    }, []);

    return (
        <EditorShell title={t('editor.review.title', 'Berita Review')}>
            <section>
                <h2 className="text-[28px] leading-tight font-semibold text-slate-900">{t('editor.review.heading', 'Berita Menunggu Review')}</h2>
                <p className="mt-1 text-xs text-slate-500">{t('editor.review.subtitle', '{count} berita', { count: total })}</p>
            </section>

            <section className="mt-4 space-y-3">
                {loading ? (
                    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
                        {t('editor.review.loading', 'Memuat berita review...')}
                    </article>
                ) : articles.length ? (
                    articles.map((article) => (
                        <article key={article.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="text-sm font-semibold text-slate-900">{t(dynamicKey('editor.review.titleText', article.title), article.title)}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${articleStatusBadgeClass(article.status)}`}>
                                    {t(`workflow.status.${article.status}`, articleStatusLabel(article.status))}
                                </span>
                            </div>

                            <p className="mt-2 text-xs leading-5 text-slate-600">{article.excerpt ? t(dynamicKey('editor.review.excerptText', article.excerpt), article.excerpt) : t('editor.review.noSummary', 'Tidak ada ringkasan.')}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                    {t('editor.review.priority', 'Prioritas')}: {article.priority_score ?? 50}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                    {t('editor.review.due', 'Tenggat')}: {formatDateTime(article.review_due_at, intlLocale)}
                                </span>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{t('table.author', 'Penulis')}: {t(dynamicKey('editor.review.authorText', article.author_name), article.author_name)}</span>
                                <span>•</span>
                                <span>{t('table.category', 'Kategori')}: {t(dynamicKey('editor.review.categoryText', article.category_name), article.category_name)}</span>
                                <span>•</span>
                                <span>{t('editor.review.submittedAt', 'Dikirim')}: {formatDate(article.submitted_at, intlLocale)}</span>
                            </div>

                            <button
                                type="button"
                                className="portal-btn portal-btn-primary portal-btn-sm mt-3"
                                onClick={() => navigate(`/editor/review/${article.id}`)}
                            >
                                {t('editor.review.reviewButton', 'Tinjau Berita')}
                            </button>
                        </article>
                    ))
                ) : (
                    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
                        {t('editor.review.empty', 'Belum ada berita yang menunggu review.')}
                    </article>
                )}
            </section>
        </EditorShell>
    );
}
