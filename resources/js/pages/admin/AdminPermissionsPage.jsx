import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

const ROLE_LABELS = {
    admin: 'Admin',
    reviewer: 'Editor',
    author: 'Penulis',
    user: 'Pengguna',
};

export default function AdminPermissionsPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [data, setData] = useState({ roles: [], actions: [], matrix: {} });
    const [matrix, setMatrix] = useState({});
    const [baseMatrix, setBaseMatrix] = useState({});

    useErrorNotification(error, setError);

    async function loadMatrix() {
        const token = getToken();
        setLoading(true);
        setError('');
        setNotice('');

        try {
            const payload = await apiRequest('/admin/permissions', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.permissions.errorLoad', 'Gagal memuat matriks izin.'));
            }

            const nextData = {
                roles: payload?.data?.roles || [],
                actions: payload?.data?.actions || [],
                matrix: payload?.data?.matrix || {},
            };

            setData(nextData);
            setMatrix(nextData.matrix);
            setBaseMatrix(nextData.matrix);
        } catch (err) {
            setError(err.message || t('admin.permissions.errorLoadDefault', 'Terjadi kesalahan saat memuat matriks izin.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMatrix();
    }, []);

    const groupedActions = useMemo(() => {
        const bucket = {};

        (data.actions || []).forEach((action) => {
            const category = action?.category || 'Umum';
            if (!bucket[category]) {
                bucket[category] = [];
            }

            bucket[category].push(action);
        });

        return Object.entries(bucket).map(([category, actions]) => ({
            category,
            actions,
        }));
    }, [data.actions]);

    const changedEntries = useMemo(() => {
        const entries = [];

        (data.roles || []).forEach((role) => {
            (data.actions || []).forEach((action) => {
                const actionKey = action?.key;
                if (!actionKey) return;

                const before = Boolean(baseMatrix?.[role]?.[actionKey]);
                const after = Boolean(matrix?.[role]?.[actionKey]);

                if (before !== after) {
                    entries.push({
                        role,
                        action_key: actionKey,
                        is_allowed: after,
                    });
                }
            });
        });

        return entries;
    }, [baseMatrix, matrix, data.roles, data.actions]);

    async function saveChanges() {
        if (!changedEntries.length) {
            setNotice(t('admin.permissions.noChanges', 'Tidak ada perubahan izin.'));
            return;
        }

        const token = getToken();
        setSaving(true);
        setError('');
        setNotice('');

        try {
            const payload = await apiRequest('/admin/permissions', {
                method: 'PUT',
                token,
                body: {
                    entries: changedEntries,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.permissions.errorSave', 'Gagal menyimpan matriks izin.'));
            }

            const nextMatrix = payload?.data?.matrix || matrix;
            setMatrix(nextMatrix);
            setBaseMatrix(nextMatrix);
            setNotice(t('admin.permissions.saved', 'Perubahan izin berhasil disimpan.'));
        } catch (err) {
            setError(err.message || t('admin.permissions.errorSaveDefault', 'Terjadi kesalahan saat menyimpan izin.'));
        } finally {
            setSaving(false);
        }
    }

    function togglePermission(role, actionKey) {
        setMatrix((previous) => ({
            ...previous,
            [role]: {
                ...(previous?.[role] || {}),
                [actionKey]: !Boolean(previous?.[role]?.[actionKey]),
            },
        }));
    }

    return (
        <AdminShell
            title={t('admin.permissions.title', 'Matriks Izin')}
            subtitle={t('admin.permissions.subtitle', '{count} perubahan belum disimpan', { count: changedEntries.length })}
            action={(
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadMatrix}
                        disabled={loading || saving}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                    >
                        {t('common.refresh', 'Muat Ulang')}
                    </button>
                    <button
                        type="button"
                        onClick={saveChanges}
                        disabled={saving || loading}
                        className="portal-btn portal-btn-primary portal-btn-sm"
                    >
                        {saving ? t('common.saving', 'Menyimpan...') : t('common.save', 'Simpan')}
                    </button>
                </div>
            )}
        >
            {notice ? (
                <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {notice}
                </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-5 text-sm text-slate-500">{t('common.loadingData', 'Memuat data...')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[940px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                                    <th className="px-3 py-2.5">{t('admin.permissions.table.action', 'Aksi')}</th>
                                    {(data.roles || []).map((role) => (
                                        <th key={role} className="px-3 py-2.5 text-center">{ROLE_LABELS[role] || role}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {groupedActions.map((group) => (
                                    <React.Fragment key={group.category}>
                                        <tr className="bg-slate-50 border-y border-slate-200">
                                            <td colSpan={(data.roles || []).length + 1} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                {group.category}
                                            </td>
                                        </tr>
                                        {group.actions.map((action) => (
                                            <tr key={action.key} className="border-b border-slate-100">
                                                <td className="px-3 py-2.5 align-top">
                                                    <p className="text-slate-800 font-medium">{action.label}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{action.key}</p>
                                                </td>
                                                {(data.roles || []).map((role) => {
                                                    const checked = Boolean(matrix?.[role]?.[action.key]);
                                                    return (
                                                        <td key={`${role}-${action.key}`} className="px-3 py-2.5 text-center">
                                                            <label className="inline-flex items-center justify-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 accent-blue-600"
                                                                    checked={checked}
                                                                    onChange={() => togglePermission(role, action.key)}
                                                                />
                                                            </label>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </AdminShell>
    );
}
