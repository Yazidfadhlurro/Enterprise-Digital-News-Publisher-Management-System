import React, { useEffect, useState } from 'react';
import EditorShell from '../../components/EditorShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
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

export default function EditorPublishedPage() {
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
            const payload = await apiRequest('/reviewer/articles?status=published&per_page=20', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('editor.published.errorLoad', 'Gagal memuat berita publikasi.'));
            }

            setArticles(payload?.data?.articles || []);
            setTotal(payload?.data?.pagination?.total || 0);
        } catch (err) {
            setError(err.message || t('editor.published.errorLoadDefault', 'Terjadi kesalahan saat memuat berita publikasi.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadArticles();
    }, []);

    return (
        <EditorShell title={t('editor.published.title', 'Berita Publikasi')}>
            <section>
                <h2 className="text-[28px] leading-tight font-semibold text-slate-900">{t('editor.published.heading', 'Berita Publikasi')}</h2>
                <p className="mt-1 text-xs text-slate-500">{t('editor.published.subtitle', '{count} berita', { count: total })}</p>
            </section>

            <section className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-3">{t('table.title', 'Judul')}</th>
                                <th className="py-2.5 px-3">{t('table.author', 'Penulis')}</th>
                                <th className="py-2.5 px-3">{t('table.category', 'Kategori')}</th>
                                <th className="py-2.5 px-3">{t('editor.published.publishedAt', 'Publikasi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : articles.length ? (
                                articles.map((article) => (
                                    <tr key={article.id}>
                                        <td className="py-3 px-3 text-slate-800 font-medium">{t(dynamicKey('editor.published.titleText', article.title), article.title)}</td>
                                        <td className="py-3 px-3 text-slate-600">{t(dynamicKey('editor.published.authorText', article.author_name), article.author_name)}</td>
                                        <td className="py-3 px-3 text-slate-600">{t(dynamicKey('editor.published.categoryText', article.category_name), article.category_name)}</td>
                                        <td className="py-3 px-3 text-slate-500">{formatDate(article.published_at || article.date, intlLocale)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400">{t('editor.published.empty', 'Belum ada berita publikasi.')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </EditorShell>
    );
}
