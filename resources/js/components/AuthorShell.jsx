import React, { useMemo } from 'react';
import BackofficeShell from './BackofficeShell';
import { useI18n } from '../lib/i18n';

function DashboardIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M4.5 4.5h6v6h-6z" />
            <path d="M13.5 4.5h6v6h-6z" />
            <path d="M4.5 13.5h6v6h-6z" />
            <path d="M13.5 13.5h6v6h-6z" />
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

function CreateIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M6.75 3.75h7.5l3 3V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25z" />
            <path d="M14.25 3.75v3h3" />
            <path d="M9 13.5h6" />
            <path d="M12 10.5v6" />
        </svg>
    );
}

function ActivityIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
            <path d="M6.5 3.75 4.5 5.75" />
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

export default function AuthorShell({ title, subtitle, action, children }) {
    const { t } = useI18n();
    const navItems = useMemo(() => ([
        {
            label: t('nav.author.dashboard', 'Dashboard'),
            to: '/author/dashboard',
            Icon: DashboardIcon,
            end: true,
        },
        {
            label: t('nav.author.articles', 'Artikel Saya'),
            to: '/author/articles',
            Icon: ArticleIcon,
            isActive: (pathname) => pathname === '/author/articles' || /^\/author\/articles\/\d+\/edit$/.test(pathname),
        },
        {
            label: t('nav.author.activities', 'Log Aktivitas'),
            to: '/author/activities',
            Icon: ActivityIcon,
            end: true,
        },
        {
            label: t('nav.author.feedback', 'Komentar & Rating'),
            to: '/author/feedback',
            Icon: FeedbackIcon,
            end: true,
        },
        {
            label: t('nav.author.create', 'Buat Artikel Baru'),
            to: '/author/articles/create',
            Icon: CreateIcon,
            end: true,
        },
    ]), [t]);

    return (
        <BackofficeShell
            title={title}
            subtitle={subtitle}
            action={action}
            navItems={navItems}
            defaultDisplayName={t('role.author', 'Penulis')}
            defaultRoleLabel="author"
            shellClassName="author-shell"
        >
            {children}
        </BackofficeShell>
    );
}
