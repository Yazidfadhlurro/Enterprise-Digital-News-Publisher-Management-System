import React from 'react';
import ReaderShell from '../../components/ReaderShell';
import ProfileSettingsPage from '../../components/ProfileSettingsPage';
import { useI18n } from '../../lib/i18n';

function ReaderSettingsShell(props) {
    return <ReaderShell {...props} shellClassName="reader-shell-news-portal" />;
}

export default function ReaderSettingsPage() {
    const { t } = useI18n();

    return (
        <ProfileSettingsPage
            Shell={ReaderSettingsShell}
            title={t('settings.readerTitle', 'Pengaturan Pembaca')}
            subtitle={t('settings.readerSubtitle', 'Kelola biodata, foto profil, dan kata sandi akun pembaca.')}
            roleLabel={t('role.user', 'Pembaca')}
            variant="reader"
        />
    );
}
