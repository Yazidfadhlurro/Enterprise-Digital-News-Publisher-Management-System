import React, { useMemo } from 'react';
import BackofficeShell from './BackofficeShell';
import { useI18n } from '../lib/i18n';

function DashboardIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M3.75 4.5h6.75v6.75H3.75z" />
            <path d="M13.5 4.5h6.75v4.5H13.5z" />
            <path d="M13.5 12h6.75v7.5H13.5z" />
            <path d="M3.75 13.5h6.75v6H3.75z" />
        </svg>
    );
}

function ArticleIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M6 4.5h8.5l3.5 3.5V19.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 6 4.5z" />
            <path d="M14.5 4.5V8h3.5" />
            <path d="M8 11h8" />
            <path d="M8 14.5h8" />
            <path d="M8 18h5" />
        </svg>
    );
}

function CategoryIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M3.75 8.25A2.25 2.25 0 0 1 6 6h4l1.5 1.75H18A2.25 2.25 0 0 1 20.25 10v6.75A2.25 2.25 0 0 1 18 19H6a2.25 2.25 0 0 1-2.25-2.25v-8.5z" />
            <path d="M3.75 10.5h16.5" />
        </svg>
    );
}

function UserIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.75 19.5a5.25 5.25 0 0 1 10.5 0" />
            <circle cx="17.5" cy="9" r="2.25" />
            <path d="M14.5 19.5a4.5 4.5 0 0 1 7 0" />
        </svg>
    );
}

function AssignmentIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M4.5 6.75h6v4.5h-6z" />
            <path d="M13.5 12.75h6v4.5h-6z" />
            <path d="M10.5 9h3" />
            <path d="M13.5 9l-1.5-1.5" />
            <path d="M13.5 9l-1.5 1.5" />
            <path d="M13.5 15h-3" />
            <path d="M10.5 15l1.5-1.5" />
            <path d="M10.5 15l1.5 1.5" />
        </svg>
    );
}

function ActivityIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
            <path d="M6.5 3.75L4.5 5.75" />
            <path d="M17.5 3.75l2 2" />
        </svg>
    );
}

function FeedbackIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M5.25 6.75h13.5A2.25 2.25 0 0 1 21 9v6a2.25 2.25 0 0 1-2.25 2.25H10.5l-4.5 3v-3H5.25A2.25 2.25 0 0 1 3 15V9a2.25 2.25 0 0 1 2.25-2.25z" />
            <path d="M7.5 11.25h9" />
            <path d="M7.5 14.25h5.25" />
        </svg>
    );
}

function PermissionIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
            <path d="M9 9h6" />
            <path d="M9 12h6" />
            <path d="M9 15h3" />
        </svg>
    );
}

export default function AdminShell({ title, subtitle, action, children }) {
    const { t } = useI18n();
    const navItems = useMemo(() => ([
        { label: t('nav.admin.dashboard', 'Beranda'), to: '/admin/dashboard', Icon: DashboardIcon },
        { label: t('nav.admin.articles', 'Manajemen Berita'), to: '/admin/articles', Icon: ArticleIcon },
        { label: t('nav.admin.categories', 'Manajemen Kategori'), to: '/admin/categories', Icon: CategoryIcon },
        { label: t('nav.admin.users', 'Manajemen Pengguna'), to: '/admin/users', Icon: UserIcon },
        { label: t('nav.admin.assignments', 'Manajemen Penugasan'), to: '/admin/assignments', Icon: AssignmentIcon },
        { label: t('nav.admin.activities', 'Log Aktivitas'), to: '/admin/activities', Icon: ActivityIcon },
        { label: t('nav.admin.feedback', 'Komentar & Rating'), to: '/admin/feedback', Icon: FeedbackIcon },
        { label: t('nav.admin.permissions', 'Atur Izin Akses'), to: '/admin/permissions', Icon: PermissionIcon },
    ]), [t]);

    return (
        <BackofficeShell
            title={title}
            subtitle={subtitle}
            action={action}
            navItems={navItems}
            defaultDisplayName={t('role.admin', 'Admin')}
            defaultRoleLabel="admin"
        >
            {children}
        </BackofficeShell>
    );
}
