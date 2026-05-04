import React, { useMemo } from 'react';
import BackofficeShell from './BackofficeShell';
import { useI18n } from '../lib/i18n';

function GridIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M4.5 4.5h6v6h-6z" />
            <path d="M13.5 4.5h6v6h-6z" />
            <path d="M4.5 13.5h6v6h-6z" />
            <path d="M13.5 13.5h6v6h-6z" />
        </svg>
    );
}

function ReviewIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M6 4.5h8.5l3.5 3.5V19.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 6 4.5z" />
            <path d="M14.5 4.5V8h3.5" />
            <path d="M8 11h8" />
        </svg>
    );
}

function PublishedIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M6.75 3.75h7.5l3 3V18a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25z" />
            <path d="m8.75 13 2.25 2.25L15.25 11" />
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

export default function EditorShell({ title, subtitle, action, children }) {
    const { t } = useI18n();
    const navItems = useMemo(() => ([
        { label: t('nav.editor.dashboard', 'Dashboard'), to: '/editor/dashboard', Icon: GridIcon },
        { label: t('nav.editor.review', 'Berita Review'), to: '/editor/review', Icon: ReviewIcon },
        { label: t('nav.editor.published', 'Berita Publikasi'), to: '/editor/published', Icon: PublishedIcon },
        { label: t('nav.editor.activities', 'Log Aktivitas'), to: '/editor/activities', Icon: ActivityIcon },
        { label: t('nav.editor.feedback', 'Komentar & Rating'), to: '/editor/feedback', Icon: FeedbackIcon },
    ]), [t]);

    return (
        <BackofficeShell
            title={title}
            subtitle={subtitle}
            action={action}
            navItems={navItems}
            defaultDisplayName={t('role.editor', 'Editor')}
            defaultRoleLabel="editor"
            shellClassName="editor-shell"
        >
            {children}
        </BackofficeShell>
    );
}
