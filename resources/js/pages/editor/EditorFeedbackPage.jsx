import React from 'react';
import EditorShell from '../../components/EditorShell';
import ArticleFeedbackPage from '../../components/ArticleFeedbackPage';
import { useI18n } from '../../lib/i18n';

export default function EditorFeedbackPage() {
    const { t } = useI18n();

    return (
        <ArticleFeedbackPage
            Shell={EditorShell}
            title={t('feedback.reviewer.title', 'Komentar & Rating Berita Tugas')}
            endpoint="/reviewer/feedback"
            showInsights
            buildViewPath={(row) => (row?.article_id ? `/editor/review/${row.article_id}` : null)}
            viewButtonLabel={t('feedback.openReviewArticle', 'Lihat Berita')}
        />
    );
}
