import React from 'react';
import EditorShell from '../../components/EditorShell';
import EditorialActivityLogPage from '../../components/EditorialActivityLogPage';
import { useI18n } from '../../lib/i18n';

export default function EditorActivityPage() {
    const { t } = useI18n();

    return (
        <EditorialActivityLogPage
            Shell={EditorShell}
            title={t('activity.title', 'Log Aktivitas Editorial')}
            endpoint="/reviewer/activities"
            buildDetailPath={(activity) => (
                activity?.article_id
                    ? `/editor/review/${activity.article_id}`
                    : null
            )}
            quickActionLabel={t('activity.quickAction.viewNews', 'Lihat Berita')}
        />
    );
}
