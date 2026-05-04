import React from 'react';
import AdminShell from '../../components/AdminShell';
import ArticleFeedbackPage from '../../components/ArticleFeedbackPage';
import { useI18n } from '../../lib/i18n';

export default function AdminFeedbackPage() {
    const { t } = useI18n();

    return (
        <ArticleFeedbackPage
            Shell={AdminShell}
            title={t('feedback.admin.title', 'Komentar & Rating Berita')}
            endpoint="/admin/feedback"
        />
    );
}
