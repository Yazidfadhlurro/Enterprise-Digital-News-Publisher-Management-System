import React from 'react';
import EditorShell from '../../components/EditorShell';
import ProfileSettingsPage from '../../components/ProfileSettingsPage';
import { useI18n } from '../../lib/i18n';

export default function EditorSettingsPage() {
    const { t } = useI18n();

    return (
        <ProfileSettingsPage
            Shell={EditorShell}
            title={t('settings.editorTitle', 'Pengaturan Editor')}
            subtitle={t('settings.editorSubtitle', 'Kelola biodata, foto profil, dan password akun editor.')}
            roleLabel={t('role.editor', 'Editor')}
        />
    );
}
