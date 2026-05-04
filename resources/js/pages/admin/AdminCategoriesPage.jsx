import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

const defaultCategoryForm = {
    name: '',
    description: '',
    is_active: true,
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

export default function AdminCategoriesPage() {
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [categories, setCategories] = useState([]);
    const [panelMode, setPanelMode] = useState(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [categoryForm, setCategoryForm] = useState(defaultCategoryForm);
    const [submitting, setSubmitting] = useState(false);

    useErrorNotification(error, setError);

    async function loadCategories() {
        const token = getToken();
        setError('');
        setLoading(true);

        try {
            const payload = await apiRequest('/admin/categories', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.categories.errorLoad', 'Gagal memuat kategori.'));
            }

            setCategories(payload?.data?.categories || []);
        } catch (err) {
            setError(err.message || t('admin.categories.errorLoadDefault', 'Terjadi kesalahan saat memuat kategori.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCategories();
    }, []);

    function closePanel() {
        setPanelMode(null);
        setSelectedCategoryId(null);
        setCategoryForm(defaultCategoryForm);
    }

    async function openEditPanel(categoryId) {
        const token = getToken();
        setError('');

        try {
            const payload = await apiRequest(`/admin/categories/${categoryId}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.categories.errorLoadDetail', 'Gagal memuat detail kategori.'));
            }

            const category = payload?.data?.category;
            setSelectedCategoryId(categoryId);
            setCategoryForm({
                name: category?.name || '',
                description: category?.description || '',
                is_active: category?.is_active ?? true,
            });
            setPanelMode('edit');
        } catch (err) {
            setError(err.message || t('admin.categories.errorLoadDefault', 'Terjadi kesalahan saat memuat kategori.'));
        }
    }

    function handleFormChange(event) {
        const { name, value, type, checked } = event.target;

        setCategoryForm((previous) => ({
            ...previous,
            [name]: type === 'checkbox' ? checked : value,
        }));
    }

    async function submitCategoryForm(event) {
        event.preventDefault();

        if (!categoryForm.name.trim()) {
            setError(t('admin.categories.errorRequiredName', 'Nama kategori wajib diisi.'));
            return;
        }

        const token = getToken();
        setError('');
        setSubmitting(true);

        const body = {
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
            is_active: categoryForm.is_active,
        };

        try {
            const endpoint = panelMode === 'edit' ? `/admin/categories/${selectedCategoryId}` : '/admin/categories';
            const method = panelMode === 'edit' ? 'PUT' : 'POST';
            const payload = await apiRequest(endpoint, {
                method,
                token,
                body,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.categories.errorSave', 'Gagal menyimpan kategori.'));
            }

            closePanel();
            await loadCategories();
        } catch (err) {
            setError(err.message || t('admin.categories.errorSaveDefault', 'Terjadi kesalahan saat menyimpan kategori.'));
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteCategory(categoryId) {
        const token = getToken();
        const approved = window.confirm(t('admin.categories.confirmDelete', 'Yakin ingin menghapus kategori ini?'));

        if (!approved) {
            return;
        }

        try {
            const payload = await apiRequest(`/admin/categories/${categoryId}`, {
                method: 'DELETE',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.categories.errorDelete', 'Gagal menghapus kategori.'));
            }

            await loadCategories();
        } catch (err) {
            setError(err.message || t('admin.categories.errorDeleteDefault', 'Terjadi kesalahan saat menghapus kategori.'));
        }
    }

    return (
        <AdminShell
            title={t('admin.categories.title', 'Manajemen Kategori')}
            subtitle={t('admin.categories.subtitle', '{count} kategori', { count: categories.length })}
        >
            <div className="admin-categories-page">
            {panelMode ? (
                <section className="admin-page-panel mb-4 rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-slate-900">
                            {panelMode === 'edit'
                                ? t('admin.categories.panelEditTitle', 'Edit Kategori')
                                : t('admin.categories.panelCreateTitle', 'Tambah Kategori')}
                        </h3>
                        <button
                            type="button"
                            className="portal-btn portal-btn-secondary portal-btn-sm"
                            onClick={closePanel}
                        >
                            {t('common.close', 'Tutup')}
                        </button>
                    </div>

                    <form onSubmit={submitCategoryForm} className="space-y-3">
                        <div>
                            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('admin.categories.fieldName', 'Nama Kategori')}</label>
                            <input
                                type="text"
                                name="name"
                                value={categoryForm.name}
                                onChange={handleFormChange}
                                className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.description', 'Deskripsi')}</label>
                            <textarea
                                name="description"
                                value={categoryForm.description}
                                onChange={handleFormChange}
                                rows={3}
                                className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                            />
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={categoryForm.is_active}
                                onChange={handleFormChange}
                                className="rounded border-slate-300"
                            />
                            {t('admin.categories.fieldActive', 'Kategori aktif')}
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
                                        : t('admin.categories.saveCategory', 'Simpan Kategori')}
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
                </section>
            ) : null}

            <section className="admin-page-panel rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="admin-page-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-2">{t('admin.categories.fieldName', 'Nama Kategori')}</th>
                                <th className="py-2.5 px-2">{t('table.slug', 'Slug')}</th>
                                <th className="py-2.5 px-2">{t('admin.categories.table.articleCount', 'Jumlah Artikel')}</th>
                                <th className="py-2.5 px-2">{t('admin.categories.table.createdAt', 'Tanggal Dibuat')}</th>
                                <th className="py-2.5 px-2">{t('table.action', 'Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : categories.length ? (
                                categories.map((category) => (
                                    <tr key={category.id}>
                                        <td className="py-3 px-2 font-medium text-slate-800">{t(`admin.categories.name.${category.id}`, category.name || '-')}</td>
                                        <td className="py-3 px-2 text-slate-600">{category.slug}</td>
                                        <td className="py-3 px-2 text-slate-600">{category.articles_count}</td>
                                        <td className="py-3 px-2 text-slate-500">{formatDate(category.created_at, intlLocale)}</td>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                    onClick={() => openEditPanel(category.id)}
                                                >
                                                    {t('table.edit', 'Edit')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-danger portal-btn-sm"
                                                    onClick={() => deleteCategory(category.id)}
                                                >
                                                    {t('table.delete', 'Hapus')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">{t('admin.categories.empty', 'Belum ada kategori.')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            </div>
        </AdminShell>
    );
}
