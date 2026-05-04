import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useErrorNotification } from '../../lib/notify';

function reviewerStatusBadge(status) {
    if (status === 'active') {
        return 'assignment-status-badge assignment-status-badge-active bg-emerald-100 text-emerald-700';
    }

    if (status === 'suspended') {
        return 'assignment-status-badge assignment-status-badge-suspended bg-red-100 text-red-700';
    }

    return 'assignment-status-badge assignment-status-badge-inactive bg-slate-200 text-slate-700';
}

function reviewerStatusLabel(status) {
    const map = {
        active: 'Aktif',
        inactive: 'Nonaktif',
        suspended: 'Ditangguhkan',
    };

    return map[status] || status;
}

function AuthorCard({ author, selected, onToggle, onDragStart, onDragEnd, disabled }) {
    return (
        <article
            draggable={!disabled}
            onDragStart={(event) => onDragStart(event, author.id)}
            onDragEnd={onDragEnd}
            className={`assignment-author-card rounded-lg border px-3 py-2.5 bg-white transition ${
                disabled
                    ? 'border-slate-200 opacity-60 cursor-not-allowed'
                    : selected
                        ? 'assignment-author-selected border-blue-400 ring-2 ring-blue-100 shadow-sm cursor-grab active:cursor-grabbing'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm cursor-grab active:cursor-grabbing'
            }`}
        >
            <div className="flex items-start gap-2">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(author.id)}
                    className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{author.name}</p>
                    <p className="text-xs text-slate-500 truncate">{author.email}</p>

                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="assignment-chip assignment-chip-muted px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            Perlu ditinjau: {Number(author.pending_articles_total || 0)}
                        </span>
                        <span className={`assignment-chip px-1.5 py-0.5 rounded ${Number(author.overdue_pending_total || 0) > 0 ? 'assignment-chip-overdue bg-red-100 text-red-700' : 'assignment-chip-ok bg-emerald-100 text-emerald-700'}`}>
                            Terlambat lebih dari 2 hari: {Number(author.overdue_pending_total || 0)}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}

export default function AdminAssignmentMatrixPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({});
    const [reviewers, setReviewers] = useState([]);
    const [unassignedAuthors, setUnassignedAuthors] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);

    const [busyAuthorId, setBusyAuthorId] = useState(null);
    const [reassigningReviewerId, setReassigningReviewerId] = useState(null);
    const [selectedAuthorIds, setSelectedAuthorIds] = useState([]);
    const [bulkTargetReviewerId, setBulkTargetReviewerId] = useState('');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [reviewerColumnFilter, setReviewerColumnFilter] = useState('all');
    const [onlyOverdue, setOnlyOverdue] = useState(false);
    const [inactiveTargetByReviewer, setInactiveTargetByReviewer] = useState({});
    const [draggedAuthorId, setDraggedAuthorId] = useState(null);
    const [dragOverReviewerId, setDragOverReviewerId] = useState(null);
    const [showAuditLog, setShowAuditLog] = useState(false);

    useErrorNotification(error, setError);

    const allAuthors = useMemo(() => {
        const reviewerAuthors = reviewers.flatMap((reviewer) => reviewer.authors || []);
        return [...unassignedAuthors, ...reviewerAuthors];
    }, [reviewers, unassignedAuthors]);

    const authorMap = useMemo(() => {
        const map = new Map();
        allAuthors.forEach((author) => {
            map.set(Number(author.id), author);
        });
        return map;
    }, [allAuthors]);

    const activeReviewers = useMemo(
        () => reviewers.filter((reviewer) => reviewer.status === 'active'),
        [reviewers]
    );

    const normalizedKeyword = useMemo(() => searchKeyword.trim().toLowerCase(), [searchKeyword]);

    const filteredUnassignedAuthors = useMemo(
        () => unassignedAuthors.filter((author) => {
            const matchesOverdue = !onlyOverdue || Number(author.overdue_pending_total || 0) > 0;
            const searchable = `${author.name || ''} ${author.email || ''}`.toLowerCase();
            const matchesKeyword = !normalizedKeyword || searchable.includes(normalizedKeyword);
            return matchesOverdue && matchesKeyword;
        }),
        [unassignedAuthors, onlyOverdue, normalizedKeyword]
    );

    const filteredReviewers = useMemo(
        () => reviewers
            .map((reviewer) => {
                const reviewerSearchable = `${reviewer.name || ''} ${reviewer.email || ''}`.toLowerCase();
                const reviewerMatchesKeyword = normalizedKeyword
                    ? reviewerSearchable.includes(normalizedKeyword)
                    : false;

                const overdueScopedAuthors = (reviewer.authors || []).filter((author) => {
                    if (onlyOverdue && Number(author.overdue_pending_total || 0) <= 0) {
                        return false;
                    }

                    return true;
                });

                const keywordScopedAuthors = !normalizedKeyword || reviewerMatchesKeyword
                    ? overdueScopedAuthors
                    : overdueScopedAuthors.filter((author) => {
                        const authorSearchable = `${author.name || ''} ${author.email || ''}`.toLowerCase();
                        return authorSearchable.includes(normalizedKeyword);
                    });

                return {
                    ...reviewer,
                    authors: keywordScopedAuthors,
                };
            })
            .filter((reviewer) => {
                if (!normalizedKeyword) {
                    return true;
                }

                const reviewerSearchable = `${reviewer.name || ''} ${reviewer.email || ''}`.toLowerCase();
                return reviewerSearchable.includes(normalizedKeyword) || (reviewer.authors || []).length > 0;
            }),
        [reviewers, onlyOverdue, normalizedKeyword]
    );

    const showUnassignedColumn = reviewerColumnFilter === 'all' || reviewerColumnFilter === 'unassigned';

    const columnScopedReviewers = useMemo(() => {
        if (reviewerColumnFilter === 'all' || reviewerColumnFilter === 'unassigned') {
            return filteredReviewers;
        }

        const numericReviewerId = Number(reviewerColumnFilter);
        if (!numericReviewerId) {
            return filteredReviewers;
        }

        return filteredReviewers.filter((reviewer) => Number(reviewer.id) === numericReviewerId);
    }, [filteredReviewers, reviewerColumnFilter]);

    const visibleAuthorIds = useMemo(() => {
        const ids = new Set();

        if (showUnassignedColumn) {
            filteredUnassignedAuthors.forEach((author) => {
                ids.add(Number(author.id));
            });
        }

        columnScopedReviewers.forEach((reviewer) => {
            (reviewer.authors || []).forEach((author) => {
                ids.add(Number(author.id));
            });
        });

        return Array.from(ids);
    }, [columnScopedReviewers, filteredUnassignedAuthors, showUnassignedColumn]);

    const hasAnyFilter = Boolean(searchKeyword.trim()) || reviewerColumnFilter !== 'all' || onlyOverdue;

    async function loadMatrix() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest('/admin/assignments/matrix', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.assignment.errorLoad', 'Gagal memuat manajemen penugasan.'));
            }

            const nextData = payload?.data || {};
            setSummary(nextData.summary || {});
            setReviewers(nextData.reviewers || []);
            setUnassignedAuthors(nextData.unassigned_authors || []);
            setRecentLogs(nextData.recent_logs || []);
            setDragOverReviewerId(null);
            setDraggedAuthorId(null);
        } catch (err) {
            setError(err.message || t('admin.assignment.errorLoadDefault', 'Terjadi kesalahan saat memuat manajemen penugasan.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMatrix();
    }, []);

    function toggleSelectAuthor(authorId) {
        const numericId = Number(authorId);

        setSelectedAuthorIds((previous) => {
            if (previous.includes(numericId)) {
                return previous.filter((id) => id !== numericId);
            }

            return [...previous, numericId];
        });
    }

    function clearSelection() {
        setSelectedAuthorIds([]);
    }

    function resetFilters() {
        setSearchKeyword('');
        setReviewerColumnFilter('all');
        setOnlyOverdue(false);
    }

    function selectAllVisibleAuthors() {
        if (!visibleAuthorIds.length) {
            return;
        }

        setSelectedAuthorIds((previous) => {
            const next = new Set(previous.map((id) => Number(id)));
            visibleAuthorIds.forEach((id) => {
                next.add(Number(id));
            });
            return Array.from(next);
        });
    }

    async function moveAuthor(authorId, targetReviewerId) {
        const numericAuthorId = Number(authorId);
        const numericReviewerId = Number(targetReviewerId);
        const author = authorMap.get(numericAuthorId);

        if (!author || !numericReviewerId) {
            return;
        }

        if (Number(author.assigned_reviewer_id || 0) === numericReviewerId) {
            return;
        }

        setBusyAuthorId(numericAuthorId);
        setError('');

        try {
            const token = getToken();
            const payload = await apiRequest('/admin/assignments/move', {
                method: 'POST',
                token,
                body: {
                    author_id: numericAuthorId,
                    to_reviewer_id: numericReviewerId,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.assignment.errorMove', 'Gagal memindahkan penugasan penulis.'));
            }

            setSelectedAuthorIds((previous) => previous.filter((id) => id !== numericAuthorId));
            await loadMatrix();
        } catch (err) {
            setError(err.message || t('admin.assignment.errorMoveDefault', 'Terjadi kesalahan saat memindahkan penugasan.'));
        } finally {
            setBusyAuthorId(null);
        }
    }

    async function submitBulkMove() {
        if (!selectedAuthorIds.length) {
            setError(t('admin.assignment.errorSelectAuthor', 'Pilih minimal satu penulis untuk dipindahkan sekaligus.'));
            return;
        }

        if (!bulkTargetReviewerId) {
            setError(t('admin.assignment.errorSelectTarget', 'Pilih editor tujuan.'));
            return;
        }

        const approved = window.confirm(
            t('admin.assignment.confirmBulkMove', 'Pindahkan {count} penulis ke editor terpilih?', {
                count: selectedAuthorIds.length,
            })
        );

        if (!approved) {
            return;
        }

        setBulkSubmitting(true);
        setError('');

        try {
            const token = getToken();
            const payload = await apiRequest('/admin/assignments/bulk-move', {
                method: 'POST',
                token,
                body: {
                    author_ids: selectedAuthorIds,
                    to_reviewer_id: Number(bulkTargetReviewerId),
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.assignment.errorBulk', 'Gagal memindahkan penulis sekaligus.'));
            }

            setSelectedAuthorIds([]);
            setBulkTargetReviewerId('');
            await loadMatrix();
        } catch (err) {
            setError(err.message || t('admin.assignment.errorBulkDefault', 'Terjadi kesalahan saat memindahkan penulis sekaligus.'));
        } finally {
            setBulkSubmitting(false);
        }
    }

    async function reassignInactiveReviewer(reviewerId, targetReviewerId = '') {
        const approved = window.confirm(
            t('admin.assignment.confirmReassignInactive', 'Alihkan semua penulis dari editor nonaktif ini ke editor aktif secara otomatis?')
        );

        if (!approved) {
            return;
        }

        setReassigningReviewerId(reviewerId);
        setError('');

        try {
            const token = getToken();
            const payload = await apiRequest('/admin/assignments/reassign-inactive-reviewer', {
                method: 'POST',
                token,
                body: {
                    reviewer_id: Number(reviewerId),
                    ...(targetReviewerId ? { target_reviewer_id: Number(targetReviewerId) } : {}),
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('admin.assignment.errorReassignInactive', 'Gagal mengalihkan penulis dari editor nonaktif.'));
            }

            setInactiveTargetByReviewer((previous) => {
                const next = { ...previous };
                delete next[reviewerId];
                return next;
            });
            await loadMatrix();
        } catch (err) {
            setError(err.message || t('admin.assignment.errorReassignInactiveDefault', 'Terjadi kesalahan saat mengalihkan editor nonaktif.'));
        } finally {
            setReassigningReviewerId(null);
        }
    }

    function onDragAuthor(event, authorId) {
        const numericAuthorId = Number(authorId);
        setDraggedAuthorId(numericAuthorId);
        event.dataTransfer.setData('text/plain', String(authorId));
        event.dataTransfer.effectAllowed = 'move';
    }

    function onDragEndAuthor() {
        setDraggedAuthorId(null);
        setDragOverReviewerId(null);
    }

    function allowDrop(event, reviewerId) {
        event.preventDefault();

        if (reviewerId) {
            setDragOverReviewerId(Number(reviewerId));
        }
    }

    async function onDropToReviewer(event, reviewerId) {
        event.preventDefault();
        setDragOverReviewerId(null);
        setDraggedAuthorId(null);

        const authorId = Number(event.dataTransfer.getData('text/plain'));
        if (!authorId) {
            return;
        }

        await moveAuthor(authorId, reviewerId);
    }

    const subtitle = t('admin.assignment.subtitle', '{count} penulis sudah terhubung ke editor', {
        count: Number(summary.authors_total || 0),
    });

    return (
        <AdminShell
            title={t('admin.assignment.title', 'Manajemen Penugasan')}
            subtitle={subtitle}
            action={(
                <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={loadMatrix}
                    disabled={loading}
                >
                    {loading ? t('common.loading', 'Memuat...') : t('common.refresh', 'Muat ulang')}
                </button>
            )}
        >
            <div className="assignment-matrix-page">
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                <article className="assignment-panel rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.assignment.summaryReviewers', 'Total Editor')}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(summary.reviewers_total || 0)}</p>
                </article>
                <article className="assignment-panel rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.assignment.summaryAuthors', 'Total Penulis')}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(summary.authors_total || 0)}</p>
                </article>
                <article className="assignment-panel rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.assignment.summaryUnassigned', 'Belum Punya Editor')}</p>
                    <p className="assignment-stat-warning mt-1 text-2xl font-semibold text-amber-600">{Number(summary.unassigned_authors_total || 0)}</p>
                </article>
                <article className="assignment-panel rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.assignment.summaryOverdue', 'Terlambat lebih dari 2 hari')}</p>
                    <p className="assignment-stat-danger mt-1 text-2xl font-semibold text-red-600">{Number(summary.overdue_pending_total || 0)}</p>
                </article>
            </section>

            <section className="assignment-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-5">
                <h2 className="text-base font-semibold text-slate-900">
                    {t('admin.assignment.quickFilterTitle', 'Aksi Cepat Penugasan')}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    {t('admin.assignment.quickFilterSubtitle', 'Pilih penulis, tentukan editor tujuan, lalu pindahkan dalam satu langkah.')}
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <label className="block">
                        <span className="text-xs text-slate-500">
                            {t('admin.assignment.searchLabel', 'Cari Nama atau Email')}
                        </span>
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(event) => setSearchKeyword(event.target.value)}
                            placeholder={t('admin.assignment.searchPlaceholder', 'Contoh: budi atau editor@portal.com')}
                            className="assignment-input mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                        />
                    </label>

                    <label className="block">
                        <span className="text-xs text-slate-500">
                            {t('admin.assignment.columnFocusLabel', 'Fokus Kolom Editor')}
                        </span>
                        <select
                            value={reviewerColumnFilter}
                            onChange={(event) => setReviewerColumnFilter(event.target.value)}
                            className="assignment-input mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                        >
                            <option value="all">{t('admin.assignment.columnFocusAll', 'Semua Kolom')}</option>
                            <option value="unassigned">{t('admin.assignment.columnFocusUnassigned', 'Belum Punya Editor')}</option>
                            {reviewers.map((reviewer) => (
                                <option key={reviewer.id} value={reviewer.id}>
                                    {reviewer.name} ({reviewerStatusLabel(reviewer.status)})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="assignment-toggle-panel mt-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={onlyOverdue}
                            onChange={(event) => setOnlyOverdue(event.target.checked)}
                        />
                        {t('admin.assignment.onlyOverdue', 'Tampilkan hanya yang terlambat lebih dari 2 hari')}
                    </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <span className="assignment-info-pill text-sm text-slate-700 rounded-lg bg-slate-100 px-3 py-2">
                        {t('admin.assignment.selectedCount', '{count} penulis terpilih', {
                            count: selectedAuthorIds.length,
                        })}
                    </span>

                    <span className="assignment-info-pill text-sm text-slate-700 rounded-lg bg-slate-100 px-3 py-2">
                        {t('admin.assignment.visibleCount', '{count} penulis di tampilan', {
                            count: visibleAuthorIds.length,
                        })}
                    </span>

                    <select
                        value={bulkTargetReviewerId}
                        onChange={(event) => setBulkTargetReviewerId(event.target.value)}
                        className="assignment-input min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    >
                        <option value="">{t('admin.assignment.selectTarget', 'Pilih editor tujuan')}</option>
                        {activeReviewers.map((reviewer) => (
                            <option key={reviewer.id} value={reviewer.id}>
                                {reviewer.name} ({Number(reviewer.active_authors_count || 0)} penulis aktif)
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={submitBulkMove}
                        disabled={bulkSubmitting || !selectedAuthorIds.length || !bulkTargetReviewerId}
                        className="portal-btn portal-btn-primary"
                    >
                        {bulkSubmitting ? t('common.processing', 'Memproses...') : t('admin.assignment.bulkMoveButton', 'Pindahkan Penulis')}
                    </button>

                    <button
                        type="button"
                        onClick={selectAllVisibleAuthors}
                        disabled={!visibleAuthorIds.length}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                    >
                        {t('admin.assignment.selectVisible', 'Pilih Semua')}
                    </button>

                    <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasAnyFilter}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                    >
                        {t('admin.assignment.resetFilter', 'Reset Filter')}
                    </button>

                    <button
                        type="button"
                        onClick={clearSelection}
                        disabled={!selectedAuthorIds.length}
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                    >
                        {t('admin.assignment.clearSelection', 'Hapus Pilihan')}
                    </button>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                    {t('admin.assignment.quickSteps', 'Langkah: 1) Centang penulis, 2) Pilih editor tujuan, 3) Klik Pindahkan Penulis.')}
                </p>
            </section>

            <section className="assignment-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm mb-5">
                <h2 className="text-base font-semibold text-slate-900">{t('admin.assignment.matrixTitle', 'Daftar Penulis per Editor')}</h2>
                <p className="text-sm text-slate-500 mt-1">
                    {t('admin.assignment.matrixHint', 'Seret kartu penulis ke kolom editor aktif untuk memindahkan penugasan.')}
                </p>

                <div className="mt-4 overflow-x-auto">
                    <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-w-full pb-2">
                        {showUnassignedColumn ? (
                            <div className="assignment-column rounded-lg border border-slate-200 bg-slate-50 p-3 min-h-[440px]">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <h3 className="text-sm font-semibold text-slate-800">{t('admin.assignment.unassignedColumn', 'Belum Punya Editor')}</h3>
                                    <span className="assignment-count-badge px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">
                                        {filteredUnassignedAuthors.length}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {loading ? (
                                        <p className="text-sm text-slate-400">{t('common.loadingData', 'Memuat data...')}</p>
                                    ) : filteredUnassignedAuthors.length ? (
                                        filteredUnassignedAuthors.map((author) => (
                                            <AuthorCard
                                                key={author.id}
                                                author={author}
                                                selected={selectedAuthorIds.includes(Number(author.id))}
                                                onToggle={toggleSelectAuthor}
                                                onDragStart={onDragAuthor}
                                                onDragEnd={onDragEndAuthor}
                                                disabled={busyAuthorId === Number(author.id)}
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-400">
                                            {hasAnyFilter
                                                ? t('admin.assignment.emptyFiltered', 'Tidak ada penulis yang cocok dengan filter saat ini.')
                                                : t('admin.assignment.emptyUnassigned', 'Semua penulis sudah memiliki editor.')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {columnScopedReviewers.map((reviewer) => {
                            const reviewerAuthors = reviewer.authors || [];
                            const isReviewerActive = reviewer.status === 'active';
                            const reviewerWarning = Number(reviewer.overdue_pending_total || 0) > 0;
                            const isDropTarget = isReviewerActive
                                && dragOverReviewerId === Number(reviewer.id)
                                && draggedAuthorId;

                            return (
                                <div
                                    key={reviewer.id}
                                    className={`assignment-column rounded-lg border p-3 min-h-[440px] transition ${
                                        isDropTarget
                                            ? 'assignment-drop-target border-blue-400 bg-blue-50'
                                            : isReviewerActive
                                                ? 'border-slate-200 bg-white'
                                                : 'border-slate-200 bg-slate-50'
                                    }`}
                                    onDragOver={(event) => {
                                        if (isReviewerActive) {
                                            allowDrop(event, reviewer.id);
                                        }
                                    }}
                                    onDragEnter={(event) => {
                                        if (isReviewerActive) {
                                            allowDrop(event, reviewer.id);
                                        }
                                    }}
                                    onDragLeave={() => {
                                        if (dragOverReviewerId === Number(reviewer.id)) {
                                            setDragOverReviewerId(null);
                                        }
                                    }}
                                    onDrop={(event) => {
                                        if (isReviewerActive) {
                                            onDropToReviewer(event, reviewer.id);
                                        } else {
                                            setDragOverReviewerId(null);
                                            setDraggedAuthorId(null);
                                        }
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-slate-900 truncate">{reviewer.name}</h3>
                                            <p className="text-xs text-slate-500 truncate">{reviewer.email}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${reviewerStatusBadge(reviewer.status)}`}>
                                            {reviewerStatusLabel(reviewer.status)}
                                        </span>
                                    </div>

                                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 flex-wrap">
                                        <span className="assignment-chip assignment-chip-muted px-1.5 py-0.5 rounded bg-slate-100">
                                            Penulis: {Number(reviewer.assigned_authors_count || 0)}
                                        </span>
                                        <span className="assignment-chip assignment-chip-muted px-1.5 py-0.5 rounded bg-slate-100">
                                            Menunggu: {Number(reviewer.pending_articles_total || 0)}
                                        </span>
                                        <span className={`assignment-chip px-1.5 py-0.5 rounded ${reviewerWarning ? 'assignment-chip-overdue bg-red-100 text-red-700' : 'assignment-chip-ok bg-emerald-100 text-emerald-700'}`}>
                                            Terlambat lebih dari 2 hari: {Number(reviewer.overdue_pending_total || 0)}
                                        </span>
                                    </div>

                                    {isReviewerActive && draggedAuthorId ? (
                                        <p className="assignment-drop-hint mt-2 text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1">
                                            {t('admin.assignment.dropHint', 'Lepaskan kartu di kolom ini untuk memindahkan penugasan.')}
                                        </p>
                                    ) : null}

                                    {!isReviewerActive && reviewerAuthors.length ? (
                                        <div className="mt-2 space-y-2">
                                            <select
                                                value={inactiveTargetByReviewer[reviewer.id] || ''}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setInactiveTargetByReviewer((previous) => ({
                                                        ...previous,
                                                        [reviewer.id]: value,
                                                    }));
                                                }}
                                                className="assignment-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                            >
                                                <option value="">
                                                    {t('admin.assignment.reassignAutoTarget', 'Pilih editor aktif (default otomatis)')}
                                                </option>
                                                {activeReviewers
                                                    .filter((activeReviewer) => Number(activeReviewer.id) !== Number(reviewer.id))
                                                    .map((activeReviewer) => (
                                                        <option key={activeReviewer.id} value={activeReviewer.id}>
                                                            {activeReviewer.name} ({Number(activeReviewer.active_authors_count || 0)} penulis aktif)
                                                        </option>
                                                    ))}
                                            </select>

                                            <button
                                                type="button"
                                                onClick={() => reassignInactiveReviewer(reviewer.id, inactiveTargetByReviewer[reviewer.id] || '')}
                                                disabled={reassigningReviewerId === reviewer.id}
                                                className="portal-btn portal-btn-warning portal-btn-sm w-full"
                                            >
                                                {reassigningReviewerId === reviewer.id
                                                    ? t('common.processing', 'Memproses...')
                                                    : t('admin.assignment.reassignInactiveOneClick', 'Alihkan Penulis')}
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="mt-3 space-y-2">
                                        {loading ? (
                                            <p className="text-sm text-slate-400">{t('common.loadingData', 'Memuat data...')}</p>
                                        ) : reviewerAuthors.length ? (
                                            reviewerAuthors.map((author) => (
                                                <AuthorCard
                                                    key={author.id}
                                                    author={author}
                                                    selected={selectedAuthorIds.includes(Number(author.id))}
                                                    onToggle={toggleSelectAuthor}
                                                    onDragStart={onDragAuthor}
                                                    onDragEnd={onDragEndAuthor}
                                                    disabled={busyAuthorId === Number(author.id)}
                                                />
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-400">
                                                {hasAnyFilter
                                                    ? t('admin.assignment.emptyFiltered', 'Tidak ada penulis yang cocok dengan filter saat ini.')
                                                    : t('admin.assignment.emptyReviewerColumn', 'Belum ada penulis.')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="assignment-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">{t('admin.assignment.auditTitle', 'Riwayat Perubahan Penugasan')}</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {t('admin.assignment.auditSubtitle', 'Semua perubahan penugasan penulis ke editor tercatat otomatis.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="portal-btn portal-btn-secondary portal-btn-sm"
                        onClick={() => setShowAuditLog((previous) => !previous)}
                    >
                        {showAuditLog
                            ? t('admin.assignment.hideAudit', 'Sembunyikan Riwayat')
                            : t('admin.assignment.showAudit', 'Tampilkan Riwayat')}
                    </button>
                </div>

                {showAuditLog ? (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="assignment-table-head text-left text-[11px] uppercase tracking-wide text-slate-500 border-y border-slate-200 bg-slate-50">
                                    <th className="py-2.5 px-2">{t('admin.assignment.auditAction', 'Aksi')}</th>
                                    <th className="py-2.5 px-2">{t('table.author', 'Penulis')}</th>
                                    <th className="py-2.5 px-2">{t('admin.assignment.auditMove', 'Perpindahan')}</th>
                                    <th className="py-2.5 px-2">{t('table.actor', 'Aktor')}</th>
                                    <th className="py-2.5 px-2">{t('table.note', 'Catatan')}</th>
                                    <th className="py-2.5 px-2">{t('table.time', 'Waktu')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-slate-400">{t('common.loadingData', 'Memuat data...')}</td>
                                    </tr>
                                ) : recentLogs.length ? (
                                    recentLogs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="py-3 px-2 text-slate-700 font-medium">{log.action_label || log.action}</td>
                                            <td className="py-3 px-2 text-slate-700">{log.author_name || '-'}</td>
                                            <td className="py-3 px-2 text-slate-600">
                                                <span className="text-slate-500">{log.from_reviewer_name || '-'}</span>
                                                {' -> '}
                                                <span className="text-slate-800 font-medium">{log.to_reviewer_name || '-'}</span>
                                            </td>
                                            <td className="py-3 px-2 text-slate-600">{log.actor_name || '-'}</td>
                                            <td className="py-3 px-2 text-slate-500">{log.note || '-'}</td>
                                            <td className="py-3 px-2 text-slate-500">
                                                <span className="block">{log.time || '-'}</span>
                                                <span className="block text-[11px] text-slate-400">
                                                    {log.occurred_at ? new Date(log.occurred_at).toLocaleString('id-ID') : '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-slate-400">{t('admin.assignment.auditEmpty', 'Belum ada riwayat penugasan.')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-slate-500">
                        {t('admin.assignment.auditCollapsedHint', 'Riwayat disembunyikan untuk membuat halaman lebih ringkas.')}
                    </p>
                )}
            </section>
            </div>
        </AdminShell>
    );
}
