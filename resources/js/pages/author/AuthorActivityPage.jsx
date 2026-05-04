import React from 'react';
import AuthorShell from '../../components/AuthorShell';
import EditorialActivityLogPage from '../../components/EditorialActivityLogPage';
import { useI18n } from '../../lib/i18n';

export default function AuthorActivityPage() {
    const { t } = useI18n();

    return (
        <EditorialActivityLogPage
            Shell={AuthorShell}
            title={t('activity.title', 'Log Aktivitas Editorial')}
            endpoint="/author/activities"
            buildDetailPath={(activity) => (
                activity?.article_id
                    ? `/author/articles/${activity.article_id}/edit`
                    : null
            )}
            quickActionLabel={t('activity.quickAction.openNews', 'Buka Berita')}
        />
    );
}
