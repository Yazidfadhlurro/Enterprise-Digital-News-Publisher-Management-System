import React from 'react';
import AuthorShell from '../../components/AuthorShell';
import ArticleFeedbackPage from '../../components/ArticleFeedbackPage';
import { useI18n } from '../../lib/i18n';

export default function AuthorFeedbackPage() {
    const { t } = useI18n();

    return (
        <ArticleFeedbackPage
            Shell={AuthorShell}
            title={t('feedback.author.title', 'Komentar & Rating Berita Saya')}
            endpoint="/author/feedback"
            showInsights
            buildViewPath={(row) => (row?.article_id ? `/author/articles/${row.article_id}/edit` : null)}
            viewButtonLabel={t('feedback.openOwnArticle', 'Lihat Berita')}
        />
    );
}
