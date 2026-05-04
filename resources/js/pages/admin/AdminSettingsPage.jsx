import React from 'react';
import AdminShell from '../../components/AdminShell';
import ProfileSettingsPage from '../../components/ProfileSettingsPage';
import { useI18n } from '../../lib/i18n';

export default function AdminSettingsPage() {
    const { t } = useI18n();

    return (
        <ProfileSettingsPage
            Shell={AdminShell}
            title={t('settings.adminTitle', 'Pengaturan Admin')}
            subtitle={t('settings.adminSubtitle', 'Kelola biodata, foto profil, dan password akun admin.')}
            roleLabel={t('role.admin', 'Admin')}
        />
    );
}
