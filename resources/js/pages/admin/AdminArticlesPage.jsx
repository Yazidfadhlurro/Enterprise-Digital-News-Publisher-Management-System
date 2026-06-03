import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { articleStatusBadgeClass, articleStatusLabel } from '../../lib/articleWorkflow';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

const articleStatuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Review' },
    { value: 'revision', label: 'Revisi' },
    { value: 'approved', label: 'Approved' },
    { value: 'published', label: 'Publikasi' },
    { value: 'rejected', label: 'Rejected' },
];

const defaultFormState = {
    title: '',
    excerpt: '',
    content: '',
    category_id: '',
    status: 'draft',
    published_at: '',
    is_featured: false,
};

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

export default function AdminArticlesPage() {
    const { t, intlLocale } = useI18n();
    const navigate = useNavigate();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [articles, setArticles] = useState([]);
    const [pagination, setPagination] = useState({
        total: 0,
        current_page: 1,
        last_page: 1,
    });
    const [categories, setCategories] = useState([]);
    const [panelMode, setPanelMode] = useState(null);
    const [panelLoading, setPanelLoading] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [articleForm, setArticleForm] = useState(defaultFormState);
    const [submitting, setSubmitting] = useState(false);

    useErrorNotification(error, setError);

    async function loadArticles(targetPage = page) {
        const token = getToken();
        setError('');
        setLoading(true);

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                q: search,
                status,
                per_page: '8',
            });

            const payload = await apiRequest(`/admin/articles?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.articles.errorLoad', 'Gagal memuat data artikel.'));
            }

            const data = payload.data || {};
            setArticles(data.articles || []);
            setPagination(data.pagination || { total: 0, current_page: 1, last_page: 1 });
        } catch (err) {
            setError(err.message || t('admin.articles.errorLoadDefault', 'Terjadi kesalahan saat memuat artikel.'));
        } finally {
            setLoading(false);
        }
    }

    async function loadCategoryOptions() {
        const token = getToken();

        try {
            const payload = await apiRequest('/admin/categories', { token });
            setCategories(payload?.data?.categories || []);
        } catch (_) {
            setCategories([]);
        }
    }

    useEffect(() => {
        loadCategoryOptions();
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setPage(1);
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    useEffect(() => {
        loadArticles();
    }, [page, search, status]);

    function resetForm() {
        setArticleForm(defaultFormState);
    }

    function closePanel() {
        setPanelMode(null);
        setPanelLoading(false);
        setSelectedArticle(null);
        resetForm();
    }

    function fillFormFromArticle(article) {
        setArticleForm({
            title: article?.title || '',
            excerpt: article?.excerpt || '',
            content: article?.content || '',
            category_id: article?.category_id ? String(article.category_id) : '',
            status: article?.status || 'draft',
            published_at: article?.published_at ? String(article.published_at).slice(0, 10) : '',
            is_featured: Boolean(article?.is_featured),
        });
    }

    async function openDetailPanel(articleId) {
        const token = getToken();
        setError('');
        setPanelMode('detail');
        setPanelLoading(true);

        try {
            const payload = await apiRequest(`/admin/articles/${articleId}`, { token });
            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.articles.errorLoadDetail', 'Gagal memuat detail artikel.'));
            }

            setSelectedArticle(payload?.data?.article || null);
        } catch (err) {
            setError(err.message || t('admin.articles.errorLoadDetailDefault', 'Terjadi kesalahan saat memuat detail artikel.'));
            closePanel();
        } finally {
            setPanelLoading(false);
        }
    }

    async function openEditPanel(articleId) {
        const token = getToken();
        setError('');
        setPanelMode('edit');
        setPanelLoading(true);

        try {
            const payload = await apiRequest(`/admin/articles/${articleId}`, { token });
            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.articles.errorLoadSingle', 'Gagal memuat artikel.'));
            }

            const article = payload?.data?.article || null;
            setSelectedArticle(article);
            fillFormFromArticle(article);
        } catch (err) {
            setError(err.message || t('admin.articles.errorLoadEdit', 'Terjadi kesalahan saat memuat data edit artikel.'));
            closePanel();
        } finally {
            setPanelLoading(false);
        }
    }

    function handleFormChange(event) {
        const { name, value, type, checked } = event.target;

        setArticleForm((previous) => ({
            ...previous,
            [name]: type === 'checkbox' ? checked : value,
        }));
    }

    async function submitArticleForm(event) {
        event.preventDefault();

        if (!articleForm.title.trim() || !articleForm.content.trim()) {
            setError(t('admin.articles.errorRequiredTitleContent', 'Judul dan konten artikel wajib diisi.'));
            return;
        }

        const token = getToken();
        const body = {
            title: articleForm.title.trim(),
            excerpt: articleForm.excerpt.trim() || null,
            content: articleForm.content,
            category_id: articleForm.category_id ? Number(articleForm.category_id) : null,
            status: articleForm.status,
            published_at: articleForm.published_at || null,
            is_featured: articleForm.is_featured,
        };

        setSubmitting(true);
        setError('');

        try {
            const endpoint = panelMode === 'edit' ? `/admin/articles/${selectedArticle?.id}` : '/admin/articles';
            const method = panelMode === 'edit' ? 'PUT' : 'POST';
            const payload = await apiRequest(endpoint, {
                method,
                token,
                body,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.articles.errorSave', 'Gagal menyimpan artikel.'));
            }

            closePanel();

            if (page !== 1 && panelMode === 'create') {
                setPage(1);
            } else {
                await loadArticles(page);
            }
        } catch (err) {
            setError(err.message || t('admin.articles.errorSaveDefault', 'Terjadi kesalahan saat menyimpan artikel.'));
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteArticle(articleId) {
        const token = getToken();
        const approved = window.confirm(t('admin.articles.confirmDelete', 'Yakin ingin menghapus artikel ini?'));

        if (!approved) {
            return;
        }

        try {
            const payload = await apiRequest(`/admin/articles/${articleId}`, {
                method: 'DELETE',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.articles.errorDelete', 'Gagal menghapus artikel.'));
            }

            const nextPage = articles.length === 1 && page > 1 ? page - 1 : page;
            if (nextPage !== page) {
                setPage(nextPage);
            } else {
                await loadArticles(page);
            }
        } catch (err) {
            setError(err.message || t('admin.articles.errorDeleteDefault', 'Terjadi kesalahan saat menghapus artikel.'));
        }
    }

    function workflowStatusLabel(status) {
        return t(`workflow.status.${status}`, articleStatusLabel(status));
    }

    async function toggleFeatured(articleId, currentFeatured) {
        const token = getToken();
        const newValue = !currentFeatured;

        // Optimistic update
        setArticles((prev) => prev.map((a) => a.id === articleId ? { ...a, is_featured: newValue } : a));

        try {
            const payload = await apiRequest(`/admin/articles/${articleId}/featured`, {
                method: 'PATCH',
                token,
                body: { is_featured: newValue },
            });
            if (payload?.status !== 'success') throw new Error(payload?.message);
        } catch (err) {
            // Revert on error
            setArticles((prev) => prev.map((a) => a.id === articleId ? { ...a, is_featured: currentFeatured } : a));
            setError(err.message || 'Gagal mengubah status unggulan.');
        }
    }

    return (
        <AdminShell
            title={t('admin.articles.title', 'Manajemen Berita')}
            subtitle={t('admin.articles.subtitle', '{count} artikel', { count: pagination.total || 0 })}
        >
            <div className="admin-articles-page">
            {panelMode ? (
                <section className="admin-page-panel mb-4 rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-slate-900">
                            {panelMode === 'create'
                                ? t('admin.articles.panelCreateTitle', 'Tambah Artikel')
                                : panelMode === 'edit'
                                    ? t('admin.articles.panelEditTitle', 'Edit Artikel')
                                    : t('admin.articles.panelDetailTitle', 'Detail Artikel')}
                        </h3>
                        <button
                            type="button"
                            className="portal-btn portal-btn-secondary portal-btn-sm"
                            onClick={closePanel}
                        >
                            {t('common.close', 'Tutup')}
                        </button>
                    </div>

                    {panelLoading ? (
                        <p className="text-sm text-slate-500">{t('common.loadingData', 'Memuat data...')}</p>
                    ) : panelMode === 'detail' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.title', 'Judul')}</p>
                                <p className="font-medium text-slate-800 mt-1">{t(`admin.articles.detail.title.${selectedArticle?.id || 'default'}`, selectedArticle?.title || '-')}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.slug', 'Slug')}</p>
                                <p className="font-medium text-slate-800 mt-1">{selectedArticle?.slug || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.author', 'Penulis')}</p>
                                <p className="font-medium text-slate-800 mt-1">{t(`admin.articles.detail.author.${selectedArticle?.id || 'default'}`, selectedArticle?.author_name || '-')}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.category', 'Kategori')}</p>
                                <p className="font-medium text-slate-800 mt-1">{t(`admin.articles.detail.category.${selectedArticle?.id || 'default'}`, selectedArticle?.category_name || '-')}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.status', 'Status')}</p>
                                <p className="font-medium text-slate-800 mt-1">{workflowStatusLabel(selectedArticle?.status)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.date', 'Tanggal')}</p>
                                <p className="font-medium text-slate-800 mt-1">{formatDate(selectedArticle?.date, intlLocale)}</p>
                            </div>
                            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.summary', 'Ringkasan')}</p>
                                <p className="text-slate-700 mt-1 whitespace-pre-wrap">{t(`admin.articles.detail.excerpt.${selectedArticle?.id || 'default'}`, selectedArticle?.excerpt || '-')}</p>
                            </div>
                            <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] uppercase text-slate-500">{t('table.content', 'Konten')}</p>
                                <p className="text-slate-700 mt-1 whitespace-pre-wrap">{t(`admin.articles.detail.content.${selectedArticle?.id || 'default'}`, selectedArticle?.content || '-')}</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={submitArticleForm} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.title', 'Judul')}</label>
                                    <input
                                        type="text"
                                        name="title"
                                        value={articleForm.title}
                                        onChange={handleFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.category', 'Kategori')}</label>
                                    <select
                                        name="category_id"
                                        value={articleForm.category_id}
                                        onChange={handleFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="">{t('admin.articles.noCategory', 'Tanpa Kategori')}</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>{t(`admin.articles.categoryOption.${category.id}`, category.name || '-')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.status', 'Status')}</label>
                                    <select
                                        name="status"
                                        value={articleForm.status}
                                        onChange={handleFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    >
                                        {articleStatuses.map((item) => (
                                            <option key={item.value} value={item.value}>{workflowStatusLabel(item.value) || item.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('admin.articles.publishDate', 'Tanggal Publish')}</label>
                                    <input
                                        type="date"
                                        name="published_at"
                                        value={articleForm.published_at}
                                        onChange={handleFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.summary', 'Ringkasan')}</label>
                                <textarea
                                    name="excerpt"
                                    value={articleForm.excerpt}
                                    onChange={handleFormChange}
                                    rows={3}
                                    className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.content', 'Konten')}</label>
                                <textarea
                                    name="content"
                                    value={articleForm.content}
                                    onChange={handleFormChange}
                                    rows={8}
                                    className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    required
                                />
                            </div>

                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    name="is_featured"
                                    checked={articleForm.is_featured}
                                    onChange={handleFormChange}
                                    className="rounded border-slate-300"
                                />
                                {t('admin.articles.featured', 'Jadikan artikel unggulan')}
                            </label>

                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="portal-btn portal-btn-primary"
                                >
                                        {submitting
                                            ? t('common.saving', 'Menyimpan...')
                                            : panelMode === 'edit'
                                                ? t('common.saveChanges', 'Simpan Perubahan')
                                                : t('admin.articles.saveArticle', 'Simpan Artikel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={closePanel}
                                    className="portal-btn portal-btn-secondary"
                                >
                                        {t('common.cancel', 'Batal')}
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            ) : null}

            <section className="admin-page-panel rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder={t('admin.articles.searchPlaceholder', 'Cari judul atau penulis...')}
                            className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(event) => {
                            setPage(1);
                            setStatus(event.target.value);
                        }}
                        className="admin-page-input w-full md:w-56 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="all">{t('admin.articles.status.all', 'Semua Status')}</option>
                        <option value="draft">{workflowStatusLabel('draft')}</option>
                        <option value="pending">{workflowStatusLabel('pending')}</option>
                        <option value="revision">{workflowStatusLabel('revision')}</option>
                        <option value="approved">{workflowStatusLabel('approved')}</option>
                        <option value="published">{workflowStatusLabel('published')}</option>
                        <option value="rejected">{workflowStatusLabel('rejected')}</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="admin-page-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-2">{t('admin.articles.table.articleTitle', 'Judul Artikel')}</th>
                                <th className="py-2.5 px-2">{t('table.author', 'Penulis')}</th>
                                <th className="py-2.5 px-2">{t('table.category', 'Kategori')}</th>
                                <th className="py-2.5 px-2">{t('table.date', 'Tanggal')}</th>
                                <th className="py-2.5 px-2">{t('table.status', 'Status')}</th>
                                <th className="py-2.5 px-2 text-center">★ Rating</th>
                                <th className="py-2.5 px-2 text-center">{t('admin.articles.featured', 'Unggulan')}</th>
                                <th className="py-2.5 px-2">{t('table.action', 'Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : articles.length ? (
                                articles.map((article) => (
                                    <tr key={article.id}>
                                        <td className="py-3 px-2 font-medium text-slate-800">{t(`admin.articles.table.title.${article.id}`, article.title || '-')}</td>
                                        <td className="py-3 px-2 text-slate-600">{t(`admin.articles.table.author.${article.id}`, article.author_name || '-')}</td>
                                        <td className="py-3 px-2 text-slate-600">{t(`admin.articles.table.category.${article.id}`, article.category_name || '-')}</td>
                                        <td className="py-3 px-2 text-slate-500">{formatDate(article.date, intlLocale)}</td>
                                        <td className="py-3 px-2">
                                            <span className={`admin-page-status-badge px-2.5 py-1 rounded-full text-xs font-semibold ${articleStatusBadgeClass(article.status)}`}>
                                                {workflowStatusLabel(article.status)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-center text-sm">
                                            {article.ratings_total > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                                                    ★ {Number(article.average_rating).toFixed(1)}
                                                    <span className="text-[10px] text-slate-400 font-normal">({article.ratings_total})</span>
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleFeatured(article.id, article.is_featured)}
                                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm transition ${article.is_featured ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500'}`}
                                                title={article.is_featured ? 'Hapus dari unggulan' : 'Jadikan unggulan'}
                                            >
                                                ★
                                            </button>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-secondary portal-btn-sm admin-detail-btn"
                                                    onClick={() => navigate(`/admin/articles/${article.id}`)}
                                                >
                                                    {t('table.detail', 'Detail')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                    onClick={() => openEditPanel(article.id)}
                                                >
                                                    {t('table.edit', 'Edit')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-danger portal-btn-sm"
                                                    onClick={() => deleteArticle(article.id)}
                                                >
                                                    {t('table.delete', 'Hapus')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="py-6 text-center text-slate-400">{t('admin.articles.empty', 'Data artikel tidak ditemukan.')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                    <button
                        type="button"
                        disabled={pagination.current_page <= 1}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                        {t('pagination.prev', 'Sebelumnya')}
                    </button>

                    <span className="admin-page-pagination-badge px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white">
                        {pagination.current_page || 1}
                    </span>

                    <button
                        type="button"
                        disabled={pagination.current_page >= pagination.last_page}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setPage((prev) => Math.min(pagination.last_page || 1, prev + 1))}
                    >
                        {t('pagination.next', 'Berikutnya')}
                    </button>
                </div>
            </section>
            </div>
        </AdminShell>
    );
}
