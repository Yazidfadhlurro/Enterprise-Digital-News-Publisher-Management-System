import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken, getUser } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification, useNotify } from '../../lib/notify';

const defaultUserForm = {
    name: '',
    email: '',
    role: 'author',
    assigned_reviewer_id: '',
    password: '',
    password_confirmation: '',
};

const defaultInviteForm = {
    email: '',
    role: 'reviewer',
    expires_in_days: '7',
    note: '',
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

function roleBadgeClass(role) {
    const map = {
        admin: 'admin-role-badge admin-role-badge-admin bg-blue-100 text-blue-700',
        reviewer: 'admin-role-badge admin-role-badge-reviewer bg-amber-100 text-amber-700',
        author: 'admin-role-badge admin-role-badge-author bg-violet-100 text-violet-700',
        user: 'admin-role-badge admin-role-badge-user admin-user-badge',
    };

    return map[role] || 'admin-role-badge admin-role-badge-user admin-user-badge';
}

function roleLabel(role) {
    const map = {
        admin: 'Admin',
        reviewer: 'Editor',
        author: 'Penulis',
        user: 'Pengguna',
    };

    return map[role] || role;
}

function statusBadgeClass(status) {
    const map = {
        active: 'admin-status-badge admin-status-badge-active bg-emerald-100 text-emerald-700',
        inactive: 'admin-status-badge admin-status-badge-inactive admin-inactive-badge',
        suspended: 'admin-status-badge admin-status-badge-suspended bg-red-100 text-red-700',
    };

    return map[status] || 'admin-status-badge admin-status-badge-inactive admin-inactive-badge';
}

function statusLabel(status) {
    const map = {
        active: 'Aktif',
        inactive: 'Nonaktif',
        suspended: 'Suspended',
    };

    return map[status] || status;
}

function initials(name) {
    if (!name) return 'U';

    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

export default function AdminUsersPage() {
    const { t, intlLocale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [users, setUsers] = useState([]);
    const [reviewers, setReviewers] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, current_page: 1, last_page: 1 });
    const [page, setPage] = useState(1);
    const [actionUserId, setActionUserId] = useState(null);
    const [panelMode, setPanelMode] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userForm, setUserForm] = useState(defaultUserForm);
    const [submitting, setSubmitting] = useState(false);
    const [inviteForm, setInviteForm] = useState(defaultInviteForm);
    const [inviteLink, setInviteLink] = useState('');
    const [inviteSubmitting, setInviteSubmitting] = useState(false);

    useErrorNotification(error, setError);
    const notify = useNotify();

    const currentUser = getUser();

    async function loadUsers(targetPage = page) {
        const token = getToken();
        setError('');
        setLoading(true);

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                per_page: '10',
            });

            const payload = await apiRequest(`/admin/users?${params.toString()}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.users.errorLoad', 'Gagal memuat data user.'));
            }

            setUsers(payload?.data?.users || []);
            setPagination(payload?.data?.pagination || { total: 0, current_page: 1, last_page: 1 });
        } catch (err) {
            setError(err.message || t('admin.users.errorLoadDefault', 'Terjadi kesalahan saat memuat user.'));
        } finally {
            setLoading(false);
        }
    }

    async function loadReviewers() {
        const token = getToken();

        try {
            const params = new URLSearchParams({
                role: 'reviewer',
                status: 'active',
                per_page: '100',
            });

            const payload = await apiRequest(`/admin/users?${params.toString()}`, { token });

            if (payload?.status === 'success') {
                const reviewerItems = [...(payload?.data?.users || [])]
                    .sort((left, right) => {
                        const leftLoad = Number(left?.assigned_authors_count || 0);
                        const rightLoad = Number(right?.assigned_authors_count || 0);

                        if (leftLoad !== rightLoad) {
                            return leftLoad - rightLoad;
                        }

                        return String(left?.name || '').localeCompare(String(right?.name || ''), 'id');
                    });

                setReviewers(reviewerItems);
                return;
            }
        } catch (_) {
        }

        setReviewers([]);
    }

    useEffect(() => {
        loadUsers();
    }, [page]);

    useEffect(() => {
        loadReviewers();
    }, []);

    const totalLabel = useMemo(
        () => t('admin.users.totalLabel', '{count} user', { count: pagination.total || 0 }),
        [pagination.total, t]
    );

    function closePanel() {
        setPanelMode(null);
        setSelectedUserId(null);
        setUserForm(defaultUserForm);
        setInviteForm(defaultInviteForm);
        setInviteLink('');
    }

    function openCreatePanel() {
        setError('');
        setInviteLink('');
        setUserForm(defaultUserForm);
        setPanelMode('create');
    }

    function openInvitePanel() {
        setError('');
        setInviteLink('');
        setInviteForm(defaultInviteForm);
        setPanelMode('invite');
    }

    async function openEditPanel(userId) {
        const token = getToken();
        setError('');

        try {
            const payload = await apiRequest(`/admin/users/${userId}`, { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.users.errorLoadDetail', 'Gagal memuat detail user.'));
            }

            const user = payload?.data?.user;
            setSelectedUserId(userId);
            setUserForm({
                name: user?.name || '',
                email: user?.email || '',
                role: user?.role || 'user',
                assigned_reviewer_id: user?.assigned_reviewer_id ? String(user.assigned_reviewer_id) : '',
                password: '',
                password_confirmation: '',
            });
            setPanelMode('edit');
        } catch (err) {
            setError(err.message || t('admin.users.errorLoadDefault', 'Terjadi kesalahan saat memuat user.'));
        }
    }

    function handleUserFormChange(event) {
        const { name, value } = event.target;

        if (name === 'role') {
            setUserForm((previous) => ({
                ...previous,
                role: value,
                assigned_reviewer_id: value === 'author' ? previous.assigned_reviewer_id : '',
            }));

            return;
        }

        setUserForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function handleInviteFormChange(event) {
        const { name, value } = event.target;

        setInviteForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function submitInviteForm(event) {
        event.preventDefault();

        const token = getToken();
        const role = inviteForm.role;
        const expiresInDays = Number(inviteForm.expires_in_days || 7);

        if (!['author', 'reviewer'].includes(role)) {
            setError(t('admin.invites.errorRole', 'Role undangan harus Penulis atau Editor.'));
            return;
        }

        setInviteSubmitting(true);
        setError('');

        try {
            const payload = await apiRequest('/admin/invites', {
                method: 'POST',
                token,
                body: {
                    role,
                    email: inviteForm.email.trim() || null,
                    expires_in_days: expiresInDays,
                    note: inviteForm.note.trim() || null,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.invites.errorSave', 'Gagal membuat undangan.'));
            }

            const inviteUrl = payload?.data?.invite_url || '';
            setInviteLink(inviteUrl);
            notify.success(t('admin.invites.success', 'Link undangan berhasil dibuat.'));

            if (inviteUrl && navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(inviteUrl).catch(() => {});
            }
        } catch (err) {
            setError(err.message || t('admin.invites.errorSaveDefault', 'Terjadi kesalahan saat membuat undangan.'));
        } finally {
            setInviteSubmitting(false);
        }
    }

    async function submitUserForm(event) {
        event.preventDefault();

        if (!userForm.name.trim() || !userForm.email.trim()) {
            setError(t('admin.users.errorRequiredNameEmail', 'Nama dan email wajib diisi.'));
            return;
        }

        const hasPasswordInput = Boolean(userForm.password || userForm.password_confirmation);

        if (panelMode === 'create' && (!userForm.password || !userForm.password_confirmation)) {
            setError(t('admin.users.errorRequiredPasswordNew', 'Password dan konfirmasi password wajib diisi untuk user baru.'));
            return;
        }

        if (panelMode === 'edit' && hasPasswordInput) {
            if (!userForm.password || !userForm.password_confirmation) {
                setError(t('admin.users.errorPasswordChangeIncomplete', 'Jika ingin ganti password, isi password dan konfirmasinya.'));
                return;
            }

            if (userForm.password !== userForm.password_confirmation) {
                setError(t('admin.users.errorPasswordMismatch', 'Password baru dan konfirmasi password tidak cocok.'));
                return;
            }
        }

        const token = getToken();
        const body = {
            name: userForm.name.trim(),
            email: userForm.email.trim(),
            role: userForm.role,
            assigned_reviewer_id: userForm.role === 'author'
                ? (userForm.assigned_reviewer_id ? Number(userForm.assigned_reviewer_id) : null)
                : null,
        };

        if (panelMode === 'create' || (panelMode === 'edit' && hasPasswordInput)) {
            body.password = userForm.password;
            body.password_confirmation = userForm.password_confirmation;
        }

        setSubmitting(true);
        setError('');

        try {
            const endpoint = panelMode === 'edit' ? `/admin/users/${selectedUserId}` : '/admin/users';
            const method = panelMode === 'edit' ? 'PUT' : 'POST';
            const payload = await apiRequest(endpoint, {
                method,
                token,
                body,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.users.errorSave', 'Gagal menyimpan user.'));
            }

            closePanel();
            if (page !== 1 && panelMode === 'create') {
                setPage(1);
            } else {
                await loadUsers(page);
            }
        } catch (err) {
            setError(err.message || t('admin.users.errorSaveDefault', 'Terjadi kesalahan saat menyimpan user.'));
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteUser(user) {
        if (user.id === currentUser?.id) {
            setError(t('admin.users.errorDeleteSelf', 'Akun yang sedang digunakan tidak dapat dihapus.'));
            return;
        }

        const token = getToken();
        const approved = window.confirm(t('admin.users.confirmDelete', 'Yakin ingin menghapus user {name}?', { name: user.name }));

        if (!approved) {
            return;
        }

        setActionUserId(user.id);
        setError('');

        try {
            const payload = await apiRequest(`/admin/users/${user.id}`, {
                method: 'DELETE',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.users.errorDelete', 'Gagal menghapus user.'));
            }

            const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
            if (nextPage !== page) {
                setPage(nextPage);
            } else {
                await loadUsers(page);
            }
        } catch (err) {
            setError(err.message || t('admin.users.errorDeleteDefault', 'Terjadi kesalahan saat menghapus user.'));
        } finally {
            setActionUserId(null);
        }
    }

    async function triggerUserAction(user) {
        const token = getToken();
        const userId = user.id;

        let endpoint = null;
        let confirmMessage = '';

        if (user.status === 'active') {
            endpoint = `/admin/users/${userId}/suspend`;
            confirmMessage = t('admin.users.confirmSuspend', 'Nonaktifkan user {name}?', { name: user.name });
        } else if (user.status === 'inactive') {
            endpoint = `/admin/users/${userId}/approve`;
            confirmMessage = t('admin.users.confirmActivate', 'Aktifkan user {name}?', { name: user.name });
        } else {
            endpoint = `/admin/users/${userId}/unsuspend`;
            confirmMessage = t('admin.users.confirmUnsuspend', 'Buka suspend untuk user {name}?', { name: user.name });
        }

        const approved = window.confirm(confirmMessage);
        if (!approved) {
            return;
        }

        setActionUserId(userId);
        setError('');

        try {
            const payload = await apiRequest(endpoint, {
                method: 'POST',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.users.errorUpdateStatus', 'Gagal memperbarui status user.'));
            }
            await loadUsers(page);
        } catch (err) {
            setError(err.message || t('admin.users.errorUpdateStatusDefault', 'Terjadi kesalahan saat memperbarui user.'));
        } finally {
            setActionUserId(null);
        }
    }

    return (
        <AdminShell
            title={t('admin.users.title', 'Manajemen User')}
            subtitle={totalLabel}
            action={(
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="portal-btn portal-btn-secondary"
                        onClick={openInvitePanel}
                    >
                        {t('admin.invites.addButton', 'Buat Invite')}
                    </button>
                    <button
                        type="button"
                        className="portal-btn portal-btn-primary"
                        onClick={openCreatePanel}
                    >
                        {t('admin.users.addButton', '+ Tambah User')}
                    </button>
                </div>
            )}
        >
            <div className="admin-users-page">
            {panelMode ? (
                <section className="admin-page-panel mb-4 rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-slate-900">
                            {panelMode === 'edit'
                                ? t('admin.users.panelEditTitle', 'Edit User')
                                : panelMode === 'invite'
                                    ? t('admin.invites.panelTitle', 'Buat Undangan Internal')
                                : t('admin.users.panelCreateTitle', 'Tambah User')}
                        </h3>
                        <button
                            type="button"
                            className="portal-btn portal-btn-secondary portal-btn-sm"
                            onClick={closePanel}
                        >
                            {t('common.close', 'Tutup')}
                        </button>
                    </div>

                    {panelMode === 'invite' ? (
                        <form onSubmit={submitInviteForm} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.role', 'Role')}</label>
                                    <select
                                        name="role"
                                        value={inviteForm.role}
                                        onChange={handleInviteFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="reviewer">{t('role.editor', 'Editor')}</option>
                                        <option value="author">{t('role.author', 'Penulis')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('admin.invites.expiresInDays', 'Masa Berlaku (Hari)')}</label>
                                    <input
                                        type="number"
                                        name="expires_in_days"
                                        value={inviteForm.expires_in_days}
                                        onChange={handleInviteFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                        min="1"
                                        max="30"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.email', 'Email')} {t('common.optional', '(Opsional)')}</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={inviteForm.email}
                                        onChange={handleInviteFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                        placeholder={t('admin.invites.emailPlaceholder', 'Kosongkan jika undangan umum')}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('common.note', 'Catatan')} {t('common.optional', '(Opsional)')}</label>
                                    <textarea
                                        name="note"
                                        value={inviteForm.note}
                                        onChange={handleInviteFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                        rows="3"
                                        placeholder={t('admin.invites.notePlaceholder', 'Contoh penggunaan: editor rubrik ekonomi')}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={inviteSubmitting}
                                    className="portal-btn portal-btn-primary"
                                >
                                    {inviteSubmitting ? t('common.saving', 'Menyimpan...') : t('admin.invites.createButton', 'Buat Link Undangan')}
                                </button>
                                <button
                                    type="button"
                                    onClick={closePanel}
                                    className="portal-btn portal-btn-secondary"
                                >
                                    {t('common.cancel', 'Batal')}
                                </button>
                            </div>

                            {inviteLink ? (
                                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                                    <div className="text-xs uppercase tracking-wide text-blue-700 mb-2">{t('admin.invites.generatedLink', 'Link Undangan')}</div>
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                        <input
                                            type="text"
                                            value={inviteLink}
                                            readOnly
                                            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700"
                                        />
                                        <button
                                            type="button"
                                            className="portal-btn portal-btn-secondary"
                                            onClick={() => navigator?.clipboard?.writeText(inviteLink)}
                                        >
                                            {t('common.copy', 'Salin')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </form>
                    ) : (
                    <form onSubmit={submitUserForm} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.name', 'Nama')}</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={userForm.name}
                                    onChange={handleUserFormChange}
                                    className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.email', 'Email')}</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={userForm.email}
                                    onChange={handleUserFormChange}
                                    className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.role', 'Role')}</label>
                                <select
                                    name="role"
                                    value={userForm.role}
                                    onChange={handleUserFormChange}
                                    className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                >
                                    <option value="admin">{t('role.admin', 'Admin')}</option>
                                    <option value="reviewer">{t('role.editor', 'Editor')}</option>
                                    <option value="author">{t('role.author', 'Penulis')}</option>
                                    <option value="user">{t('role.user', 'Pengguna')}</option>
                                </select>
                            </div>

                            {userForm.role === 'author' ? (
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('admin.users.editorAssignment', 'Editor Penanggung Jawab')}</label>
                                    <select
                                        name="assigned_reviewer_id"
                                        value={userForm.assigned_reviewer_id}
                                        onChange={handleUserFormChange}
                                        className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    >
                                        <option value="">{t('admin.users.selectReviewerAuto', 'Auto (beban terendah)')}</option>
                                        {reviewers.map((reviewer) => (
                                            <option key={reviewer.id} value={reviewer.id}>
                                                {reviewer.name}
                                                {' '}
                                                ({reviewer.email})
                                                {' - '}
                                                {t('admin.users.assignedAuthorsCount', '{count} author', {
                                                    count: Number(reviewer.assigned_authors_count || 0),
                                                })}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        {t('admin.users.assignmentHint', 'Kosongkan untuk auto-assign ke editor dengan beban author aktif paling rendah.')}
                                    </p>
                                </div>
                            ) : null}

                            {panelMode === 'create' || panelMode === 'edit' ? (
                                <>
                                    <div>
                                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                                            {panelMode === 'edit'
                                                ? t('admin.users.newPasswordOptional', 'Password Baru (Opsional)')
                                                : t('register.password', 'Password')}
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={userForm.password}
                                            onChange={handleUserFormChange}
                                            className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                            minLength={6}
                                            required={panelMode === 'create'}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                                            {panelMode === 'edit'
                                                ? t('admin.users.confirmNewPassword', 'Konfirmasi Password Baru')
                                                : t('register.passwordConfirm', 'Konfirmasi Password')}
                                        </label>
                                        <input
                                            type="password"
                                            name="password_confirmation"
                                            value={userForm.password_confirmation}
                                            onChange={handleUserFormChange}
                                            className="admin-page-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                            minLength={6}
                                            required={panelMode === 'create'}
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>

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
                                        : t('admin.users.saveUser', 'Simpan User')}
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
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="admin-page-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                <th className="py-2.5 px-2">{t('admin.users.table.userName', 'Nama Pengguna')}</th>
                                <th className="py-2.5 px-2">{t('table.email', 'Email')}</th>
                                <th className="py-2.5 px-2">{t('table.role', 'Role')}</th>
                                <th className="py-2.5 px-2">{t('admin.users.editorAssignment', 'Editor Penanggung Jawab')}</th>
                                <th className="py-2.5 px-2">{t('table.status', 'Status')}</th>
                                <th className="py-2.5 px-2">{t('admin.users.table.joinedAt', 'Bergabung')}</th>
                                <th className="py-2.5 px-2">{t('table.action', 'Aksi')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                </tr>
                            ) : users.length ? (
                                users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="admin-user-avatar w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                                    {initials(user.name)}
                                                </div>
                                                <span className="font-medium text-slate-800">{t(`admin.users.userName.${user.id}`, user.name || '-')}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-slate-600">{user.email}</td>
                                        <td className="py-3 px-2">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadgeClass(user.role)}`}>
                                                {t(`role.${user.role}`, roleLabel(user.role))}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-slate-600">
                                            {user.role === 'author'
                                                ? (user.assigned_reviewer?.name || t('admin.users.unassignedReviewer', 'Belum di-assign'))
                                                : user.role === 'reviewer'
                                                    ? t('admin.users.assignedAuthorsCount', '{count} author', {
                                                        count: Number(user.assigned_authors_count || 0),
                                                    })
                                                    : '-'}
                                        </td>
                                        <td className="py-3 px-2">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(user.status)}`}>
                                                {t(`status.${user.status}`, statusLabel(user.status))}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-slate-500">{formatDate(user.created_at, intlLocale)}</td>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <button
                                                    type="button"
                                                    disabled={actionUserId === user.id || user.id === currentUser?.id}
                                                    className="portal-btn portal-btn-secondary portal-btn-sm admin-status-action-btn"
                                                    onClick={() => triggerUserAction(user)}
                                                    title={user.id === currentUser?.id ? t('admin.users.titleNoChangeSelf', 'Tidak dapat ubah status akun sendiri') : ''}
                                                >
                                                    {actionUserId === user.id
                                                        ? t('common.processing', 'Memproses...')
                                                        : user.status === 'active'
                                                            ? t('admin.users.deactivate', 'Nonaktifkan')
                                                            : t('admin.users.activate', 'Aktifkan')}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="portal-btn portal-btn-secondary portal-btn-sm"
                                                    onClick={() => openEditPanel(user.id)}
                                                >
                                                    {t('table.edit', 'Edit')}
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={actionUserId === user.id || user.id === currentUser?.id}
                                                    className="portal-btn portal-btn-danger portal-btn-sm admin-delete-btn"
                                                    onClick={() => deleteUser(user)}
                                                    title={user.id === currentUser?.id ? t('admin.users.titleNoDeleteSelf', 'Tidak dapat hapus akun sendiri') : ''}
                                                >
                                                    {t('table.delete', 'Hapus')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-6 text-center text-slate-400">{t('admin.users.empty', 'Belum ada data user.')}</td>
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
