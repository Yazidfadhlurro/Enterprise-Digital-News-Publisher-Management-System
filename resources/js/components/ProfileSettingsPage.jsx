import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { clearAuth, getToken, getUser, updateStoredUser } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useErrorNotification, useNotify } from '../lib/notify';

const MAX_AVATAR_SIZE = 4 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const CROP_OUTPUT_SIZE = 512;
const CROP_OFFSET_LIMIT = 180;

function resolveAvatarUrl(value) {
    if (!value) return '';

    if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) {
        return value;
    }

    if (value.startsWith('storage/')) {
        return `/${value}`;
    }

    return `/storage/${value.replace(/^\/+/, '')}`;
}

function initials(name, fallback = 'U') {
    if (!name) {
        return fallback;
    }

    const chars = String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');

    return chars || fallback;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));

        reader.readAsDataURL(file);
    });
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Gagal memuat gambar untuk crop.'));
        image.src = source;
    });
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Gagal memproses hasil crop gambar.'));
                return;
            }

            resolve(blob);
        }, mimeType, quality);
    });
}

export default function ProfileSettingsPage({
    Shell,
    title,
    subtitle,
    roleLabel,
    variant = 'default',
}) {
    const navigate = useNavigate();
    const notify = useNotify();
    const { t } = useI18n();
    const currentUser = getUser();

    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [error, setError] = useState('');

    const [profileForm, setProfileForm] = useState({
        name: String(currentUser?.name || ''),
        email: String(currentUser?.email || ''),
        phone: String(currentUser?.phone || ''),
        address: String(currentUser?.address || ''),
        bio: String(currentUser?.bio || ''),
    });
    const [avatarPreview, setAvatarPreview] = useState(resolveAvatarUrl(currentUser?.avatar || ''));
    const [avatarFile, setAvatarFile] = useState(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [cropSource, setCropSource] = useState('');
    const [cropZoom, setCropZoom] = useState(1);
    const [cropOffsetX, setCropOffsetX] = useState(0);
    const [cropOffsetY, setCropOffsetY] = useState(0);
    const [processingAvatar, setProcessingAvatar] = useState(false);

    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const avatarObjectUrlRef = useRef(null);

    useErrorNotification(error, setError);

    function clearLocalAvatarPreviewObjectUrl() {
        if (avatarObjectUrlRef.current) {
            URL.revokeObjectURL(avatarObjectUrlRef.current);
            avatarObjectUrlRef.current = null;
        }
    }

    function resetCropState() {
        setCropSource('');
        setCropZoom(1);
        setCropOffsetX(0);
        setCropOffsetY(0);
        setProcessingAvatar(false);
    }

    function closeCropModal() {
        setIsCropModalOpen(false);
        resetCropState();
    }

    useEffect(() => () => {
        clearLocalAvatarPreviewObjectUrl();
    }, []);

    useEffect(() => {
        if (!isCropModalOpen) {
            return undefined;
        }

        function onKeyDown(event) {
            if (event.key === 'Escape' && !processingAvatar) {
                closeCropModal();
            }
        }

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isCropModalOpen, processingAvatar]);

    async function loadProfile() {
        const token = getToken();
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest('/auth/me', { token });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('settings.errorLoadProfile', 'Gagal memuat data profil.'));
            }

            const user = payload?.data?.user || {};
            setProfileForm({
                name: String(user?.name || ''),
                email: String(user?.email || ''),
                phone: String(user?.phone || ''),
                address: String(user?.address || ''),
                bio: String(user?.bio || ''),
            });

            clearLocalAvatarPreviewObjectUrl();
            setAvatarPreview(resolveAvatarUrl(user?.avatar || ''));
            setAvatarFile(null);

            const mergedUser = {
                ...getUser(),
                ...user,
            };
            updateStoredUser(mergedUser);
        } catch (err) {
            setError(err.message || t('settings.errorLoadProfileDefault', 'Terjadi kesalahan saat memuat profil.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadProfile();
    }, []);

    function onProfileInputChange(event) {
        const { name, value } = event.target;

        setProfileForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function onPasswordInputChange(event) {
        const { name, value } = event.target;

        setPasswordForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function onAvatarChange(event) {
        const inputElement = event.target;
        const file = inputElement?.files?.[0];
        setError('');

        if (inputElement) {
            inputElement.value = '';
        }

        if (!file) {
            return;
        }

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            setError(t('settings.errorAvatarType', 'Format foto profil harus PNG, JPG, atau WEBP.'));
            return;
        }

        if (file.size > MAX_AVATAR_SIZE) {
            setError(t('settings.errorAvatarSize', 'Ukuran foto profil maksimal 4MB.'));
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setCropSource(dataUrl);
            setCropZoom(1);
            setCropOffsetX(0);
            setCropOffsetY(0);
            setIsCropModalOpen(true);
        } catch (err) {
            setError(err.message || t('settings.errorAvatarRead', 'Terjadi kesalahan saat memproses foto profil.'));
        }
    }

    async function applyAvatarCrop() {
        if (!cropSource) {
            return;
        }

        setProcessingAvatar(true);
        setError('');

        try {
            const image = await loadImage(cropSource);

            const canvas = document.createElement('canvas');
            canvas.width = CROP_OUTPUT_SIZE;
            canvas.height = CROP_OUTPUT_SIZE;

            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error(t('settings.errorAvatarProcess', 'Gagal memproses crop foto profil.'));
            }

            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

            const baseScale = Math.max(CROP_OUTPUT_SIZE / image.width, CROP_OUTPUT_SIZE / image.height);
            const finalScale = baseScale * cropZoom;
            const drawWidth = image.width * finalScale;
            const drawHeight = image.height * finalScale;
            const drawX = ((CROP_OUTPUT_SIZE - drawWidth) / 2) + cropOffsetX;
            const drawY = ((CROP_OUTPUT_SIZE - drawHeight) / 2) + cropOffsetY;

            context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

            const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
            const processedFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });

            clearLocalAvatarPreviewObjectUrl();

            const objectUrl = URL.createObjectURL(blob);
            avatarObjectUrlRef.current = objectUrl;

            setAvatarPreview(objectUrl);
            setAvatarFile(processedFile);
            notify.success(t('settings.avatarReady', 'Foto profil siap diunggah.'));
            closeCropModal();
        } catch (err) {
            setError(err.message || t('settings.errorAvatarProcessDefault', 'Terjadi kesalahan saat crop foto profil.'));
            setProcessingAvatar(false);
        }
    }

    async function submitProfile(event) {
        event.preventDefault();

        const cleanName = profileForm.name.trim();
        const cleanEmail = profileForm.email.trim();
        const cleanPhone = profileForm.phone.trim();
        const cleanAddress = profileForm.address.trim();
        const cleanBio = profileForm.bio.trim();

        if (!cleanName || !cleanEmail) {
            setError(t('settings.errorProfileRequired', 'Nama dan email wajib diisi.'));
            return;
        }

        const token = getToken();
        setSavingProfile(true);
        setError('');

        try {
            let payload;

            if (avatarFile) {
                const formData = new FormData();
                formData.append('_method', 'PUT');
                formData.append('name', cleanName);
                formData.append('email', cleanEmail);
                formData.append('phone', cleanPhone);
                formData.append('address', cleanAddress);
                formData.append('bio', cleanBio);
                formData.append('avatar', avatarFile);

                payload = await apiRequest('/auth/profile', {
                    method: 'POST',
                    token,
                    body: formData,
                });
            } else {
                payload = await apiRequest('/auth/profile', {
                    method: 'PUT',
                    token,
                    body: {
                        name: cleanName,
                        email: cleanEmail,
                        phone: cleanPhone || null,
                        address: cleanAddress || null,
                        bio: cleanBio || null,
                    },
                });
            }

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('settings.errorProfileSave', 'Gagal menyimpan biodata.'));
            }

            const user = payload?.data?.user || {};
            const mergedUser = {
                ...getUser(),
                ...user,
            };

            updateStoredUser(mergedUser);
            window.dispatchEvent(new Event('user-updated'));

            setProfileForm({
                name: String(mergedUser?.name || ''),
                email: String(mergedUser?.email || ''),
                phone: String(mergedUser?.phone || ''),
                address: String(mergedUser?.address || ''),
                bio: String(mergedUser?.bio || ''),
            });

            const resolvedAvatar = resolveAvatarUrl(mergedUser?.avatar || '');
            setAvatarPreview(resolvedAvatar);
            setAvatarFile(null);
            clearLocalAvatarPreviewObjectUrl();

            notify.success(t('settings.profileSaved', 'Biodata dan foto profil berhasil diperbarui.'));
        } catch (err) {
            setError(err.message || t('settings.errorProfileSaveDefault', 'Terjadi kesalahan saat menyimpan biodata.'));
        } finally {
            setSavingProfile(false);
        }
    }

    async function submitPassword(event) {
        event.preventDefault();

        if (!passwordForm.current_password || !passwordForm.password || !passwordForm.password_confirmation) {
            setError(t('settings.errorPasswordRequired', 'Semua field password wajib diisi.'));
            return;
        }

        if (passwordForm.password !== passwordForm.password_confirmation) {
            setError(t('settings.errorPasswordMismatch', 'Password baru dan konfirmasi password tidak cocok.'));
            return;
        }

        const token = getToken();
        setSavingPassword(true);
        setError('');

        try {
            const payload = await apiRequest('/auth/change-password', {
                method: 'POST',
                token,
                body: {
                    current_password: passwordForm.current_password,
                    password: passwordForm.password,
                    password_confirmation: passwordForm.password_confirmation,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('settings.errorPasswordSave', 'Gagal mengubah password.'));
            }

            notify.info(t('settings.passwordSaved', 'Password berhasil diubah. Silakan login kembali.'));
            clearAuth();
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || t('settings.errorPasswordSaveDefault', 'Terjadi kesalahan saat mengubah password.'));
        } finally {
            setSavingPassword(false);
        }
    }

    const avatarInitial = useMemo(
        () => initials(profileForm.name, initials(currentUser?.name, 'U')),
        [currentUser?.name, profileForm.name]
    );

    const variantClassName = variant === 'reader' ? 'reader-settings-page' : '';

    return (
        <Shell
            title={title}
            subtitle={subtitle}
        >
            <div className={`settings-page-root space-y-4 ${variantClassName}`.trim()}>
                <section className="settings-section-card settings-section-profile rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {loading ? (
                        <p className="text-sm text-slate-500">{t('common.loadingData', 'Memuat data...')}</p>
                    ) : (
                        <form onSubmit={submitProfile} className="settings-profile-form grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
                            <div className="settings-avatar-column space-y-3">
                                <div className="w-28 h-28 rounded-full overflow-hidden border border-slate-200 bg-slate-100">
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt={t('settings.profilePhotoAlt', 'Foto profil')}
                                            className="w-full h-full object-cover"
                                            onError={() => setAvatarPreview('')}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-slate-600">
                                            {avatarInitial}
                                        </div>
                                    )}
                                </div>

                                <label className="portal-btn portal-btn-secondary portal-btn-sm inline-flex cursor-pointer">
                                    {t('settings.changePhoto', 'Ganti Foto')}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={onAvatarChange}
                                    />
                                </label>

                                <p className="text-[11px] text-slate-500">{t('settings.photoHint', 'PNG/JPG/WEBP maksimal 4MB.')}</p>
                            </div>

                            <div className="space-y-3">
                                <h2 className="text-base font-semibold text-slate-900">{t('settings.profileTitle', 'Biodata')}</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.name', 'Nama')}</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={profileForm.name}
                                            onChange={onProfileInputChange}
                                            className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('table.email', 'Email')}</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={profileForm.email}
                                            onChange={onProfileInputChange}
                                            className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.phone', 'Nomor HP')}</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={profileForm.phone}
                                            onChange={onProfileInputChange}
                                            className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                            placeholder={t('settings.phonePlaceholder', 'Contoh: 081234567890')}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.address', 'Alamat')}</label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={profileForm.address}
                                            onChange={onProfileInputChange}
                                            className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                            placeholder={t('settings.addressPlaceholder', 'Alamat singkat')}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.bio', 'Bio Singkat')}</label>
                                    <textarea
                                        name="bio"
                                        value={profileForm.bio}
                                        onChange={onProfileInputChange}
                                        rows={3}
                                        maxLength={1000}
                                        className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                        placeholder={t('settings.bioPlaceholder', 'Tulis deskripsi singkat tentang Anda...')}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="portal-btn portal-btn-primary"
                                    disabled={savingProfile}
                                >
                                    {savingProfile
                                        ? t('common.saving', 'Menyimpan...')
                                        : t('settings.saveProfile', 'Simpan Biodata')}
                                </button>
                            </div>
                        </form>
                    )}
                </section>

                <section className="settings-section-card settings-section-security rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <form onSubmit={submitPassword} className="settings-password-form space-y-3">
                        <h2 className="text-base font-semibold text-slate-900">{t('settings.passwordTitle', 'Ubah Password')}</h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.currentPassword', 'Password Saat Ini')}</label>
                                <input
                                    type="password"
                                    name="current_password"
                                    value={passwordForm.current_password}
                                    onChange={onPasswordInputChange}
                                    className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.newPassword', 'Password Baru')}</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={passwordForm.password}
                                    onChange={onPasswordInputChange}
                                    className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    minLength={8}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.confirmPassword', 'Konfirmasi Password Baru')}</label>
                                <input
                                    type="password"
                                    name="password_confirmation"
                                    value={passwordForm.password_confirmation}
                                    onChange={onPasswordInputChange}
                                    className="settings-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                                    minLength={8}
                                    required
                                />
                            </div>
                        </div>

                        <p className="text-xs text-slate-500">{t('settings.passwordHint', 'Setelah password berubah, Anda akan diminta login ulang.')}</p>

                        <button
                            type="submit"
                            className="portal-btn portal-btn-warning"
                            disabled={savingPassword}
                        >
                            {savingPassword
                                ? t('common.processing', 'Memproses...')
                                : t('settings.savePassword', 'Simpan Password Baru')}
                        </button>
                    </form>
                </section>

                {isCropModalOpen ? (
                    <section className="fixed inset-0 z-[140] flex items-center justify-center p-4" role="presentation">
                        <div className="absolute inset-0 bg-slate-950/60" onClick={() => !processingAvatar && closeCropModal()} />

                        <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                            <h3 className="text-base font-semibold text-slate-900">{t('settings.cropTitle', 'Atur Crop Foto Profil')}</h3>
                            <p className="mt-1 text-xs text-slate-500">{t('settings.cropSubtitle', 'Geser posisi dan zoom sebelum menyimpan foto profil.')}</p>

                            <div className="mt-4 flex justify-center">
                                <div className="w-60 h-60 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                    {cropSource ? (
                                        <img
                                            src={cropSource}
                                            alt={t('settings.cropPreviewAlt', 'Pratinjau crop foto profil')}
                                            className="w-full h-full object-cover transition-transform"
                                            style={{
                                                transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`,
                                                transformOrigin: 'center',
                                            }}
                                        />
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.cropZoom', 'Zoom')}</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="0.01"
                                        value={cropZoom}
                                        onChange={(event) => setCropZoom(Number(event.target.value))}
                                        className="w-full"
                                        disabled={processingAvatar}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.cropHorizontal', 'Geser Horizontal')}</label>
                                    <input
                                        type="range"
                                        min={String(-CROP_OFFSET_LIMIT)}
                                        max={String(CROP_OFFSET_LIMIT)}
                                        step="1"
                                        value={cropOffsetX}
                                        onChange={(event) => setCropOffsetX(Number(event.target.value))}
                                        className="w-full"
                                        disabled={processingAvatar}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('settings.cropVertical', 'Geser Vertikal')}</label>
                                    <input
                                        type="range"
                                        min={String(-CROP_OFFSET_LIMIT)}
                                        max={String(CROP_OFFSET_LIMIT)}
                                        step="1"
                                        value={cropOffsetY}
                                        onChange={(event) => setCropOffsetY(Number(event.target.value))}
                                        className="w-full"
                                        disabled={processingAvatar}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    className="portal-btn portal-btn-secondary"
                                    onClick={closeCropModal}
                                    disabled={processingAvatar}
                                >
                                    {t('common.cancel', 'Batal')}
                                </button>
                                <button
                                    type="button"
                                    className="portal-btn portal-btn-primary"
                                    onClick={applyAvatarCrop}
                                    disabled={processingAvatar}
                                >
                                    {processingAvatar
                                        ? t('common.processing', 'Memproses...')
                                        : t('settings.applyCrop', 'Gunakan Foto Ini')}
                                </button>
                            </div>
                        </div>
                    </section>
                ) : null}
            </div>
        </Shell>
    );
}
