import React from 'react';
import AuthorShell from '../../components/AuthorShell';
import ProfileSettingsPage from '../../components/ProfileSettingsPage';
import { useI18n } from '../../lib/i18n';

export default function AuthorSettingsPage() {
    const { t } = useI18n();

    return (
        <ProfileSettingsPage
            Shell={AuthorShell}
            title={t('settings.authorTitle', 'Pengaturan Penulis')}
            subtitle={t('settings.authorSubtitle', 'Kelola biodata, foto profil, dan password akun penulis.')}
            roleLabel={t('role.author', 'Penulis')}
        />
    );
}
