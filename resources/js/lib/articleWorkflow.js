export const ARTICLE_STATUS_LABELS = {
    draft: 'Draf',
    pending: 'Review',
    revision: 'Revisi',
    published: 'Publikasi',
    approved: 'Disetujui',
    rejected: 'Ditolak',
};

const ARTICLE_STATUS_BADGE_CLASSES = {
    draft: 'bg-violet-100 text-violet-700',
    pending: 'bg-amber-100 text-amber-700',
    revision: 'bg-rose-100 text-rose-700',
    published: 'bg-emerald-100 text-emerald-700',
    approved: 'bg-sky-100 text-sky-700',
    rejected: 'bg-red-100 text-red-700',
};

export function articleStatusLabel(status) {
    return ARTICLE_STATUS_LABELS[status] || String(status || '-');
}

export function articleStatusBadgeClass(status) {
    return ARTICLE_STATUS_BADGE_CLASSES[status] || 'bg-slate-100 text-slate-700';
}
