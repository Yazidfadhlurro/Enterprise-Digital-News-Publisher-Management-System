import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { clearAuth, getToken, getUser } from '../lib/auth';
import { useI18n } from '../lib/i18n';

function ModeNormalIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M12 4.5a5.25 5.25 0 0 0-3.5 9.17c.66.57 1.06 1.41 1.06 2.3V17.25h5v-1.28c0-.89.4-1.73 1.06-2.3A5.25 5.25 0 0 0 12 4.5z" />
            <path d="M10 19.25h4" />
            <path d="M10.75 21h2.5" />
            <path d="M12 2.5v1.25" />
            <path d="M5.75 6.25l.9.9" />
            <path d="M18.25 6.25l-.9.9" />
        </svg>
    );
}

function ModeNightIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M14.5 3.75A8.25 8.25 0 1 0 20.25 13a6.5 6.5 0 0 1-5.75-9.25z" />
        </svg>
    );
}

function ModeReadIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h4.5A2.25 2.25 0 0 1 13.5 6.75V19.5H6.75A2.25 2.25 0 0 0 4.5 21.75z" />
            <path d="M19.5 6.75A2.25 2.25 0 0 0 17.25 4.5h-4.5A2.25 2.25 0 0 0 10.5 6.75V19.5h6.75a2.25 2.25 0 0 1 2.25 2.25z" />
        </svg>
    );
}

const readerUiModeOrder = ['normal', 'night', 'read'];
const readerUiModeStorageKey = 'reader_ui_mode';

function buildReaderUiModeMeta(t) {
    return {
        normal: {
            label: t('mode.normal', 'Mode Terang'),
            Icon: ModeNormalIcon,
        },
        night: {
            label: t('mode.night', 'Mode Gelap'),
            Icon: ModeNightIcon,
        },
        read: {
            label: t('mode.read', 'Mode Baca'),
            Icon: ModeReadIcon,
        },
    };
}

function readReaderUiMode() {
    try {
        const saved = localStorage.getItem(readerUiModeStorageKey);
        if (saved && readerUiModeOrder.includes(saved)) {
            return saved;
        }
    } catch (_) {
    }

    return 'normal';
}

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

function initials(name, fallback = 'P') {
    if (!name) return fallback;

    const chars = String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');

    return chars || fallback;
}

export default function ReaderShell({
    title,
    subtitle,
    action,
    children,
    shellClassName = '',
    hideFooter = false,
    footerCategories = [],
}) {
    const navigate = useNavigate();
    const user = getUser();
    const { t, intlLocale } = useI18n();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef(null);
    const readingZoneRef = useRef(null);
    const contentRef = useRef(null);
    const [uiMode, setUiMode] = useState(readReaderUiMode);

    const avatarUrl = resolveAvatarUrl(user?.avatar || '');
    const avatarInitial = initials(user?.name || '', 'P');
    const displayName = user?.name || t('role.user', 'Pembaca');
    const todayLabel = useMemo(() => {
        return new Date().toLocaleDateString(intlLocale || 'id-ID', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    }, [intlLocale]);
    const uiModeMeta = useMemo(() => buildReaderUiModeMeta(t), [t]);
    const currentMode = useMemo(() => uiModeMeta[uiMode] || uiModeMeta.normal, [uiMode, uiModeMeta]);
    const CurrentModeIcon = currentMode.Icon;
    const isPortalVariant = shellClassName.includes('reader-shell-news-portal');

    useEffect(() => {
        try {
            localStorage.setItem(readerUiModeStorageKey, uiMode);
        } catch (_) {
        }
    }, [uiMode]);

    useEffect(() => {
        if (!isProfileMenuOpen) {
            return undefined;
        }

        function closeProfileMenuOnOutsideClick(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileMenuOpen(false);
            }
        }

        function closeProfileMenuOnEscape(event) {
            if (event.key === 'Escape') {
                setIsProfileMenuOpen(false);
            }
        }

        document.addEventListener('mousedown', closeProfileMenuOnOutsideClick);
        document.addEventListener('touchstart', closeProfileMenuOnOutsideClick);
        document.addEventListener('keydown', closeProfileMenuOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeProfileMenuOnOutsideClick);
            document.removeEventListener('touchstart', closeProfileMenuOnOutsideClick);
            document.removeEventListener('keydown', closeProfileMenuOnEscape);
        };
    }, [isProfileMenuOpen]);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) {
            return undefined;
        }

        const targets = Array.from(container.children).filter((element) => {
            const tag = element.tagName;
            const isEligibleTag = tag === 'SECTION' || tag === 'ARTICLE' || tag === 'DIV';
            return isEligibleTag && !element.classList.contains('reader-footer-gap');
        });

        if (!targets.length) {
            return undefined;
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        targets.forEach((target) => {
            target.classList.add('reader-scroll-reveal');

            if (prefersReducedMotion) {
                target.classList.add('is-visible');
            }
        });

        if (prefersReducedMotion) {
            return () => {
                targets.forEach((target) => target.classList.remove('reader-scroll-reveal', 'is-visible'));
            };
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                root: readingZoneRef.current,
                threshold: 0.14,
                rootMargin: '0px 0px -8% 0px',
            }
        );

        targets.forEach((target) => observer.observe(target));

        return () => {
            observer.disconnect();
            targets.forEach((target) => target.classList.remove('reader-scroll-reveal', 'is-visible'));
        };
    }, [children]);

    async function logout() {
        const token = getToken();

        try {
            if (token) {
                await apiRequest('/auth/logout', {
                    method: 'POST',
                    token,
                });
            }
        } catch (_) {
        } finally {
            clearAuth();
            navigate('/', { replace: true });
        }
    }

    function handleProfileMenuNavigate(path) {
        setIsProfileMenuOpen(false);
        navigate(path);
    }

    async function handleProfileMenuLogout() {
        setIsProfileMenuOpen(false);
        await logout();
    }

    function cycleUiMode() {
        setUiMode((previousMode) => {
            const currentIndex = readerUiModeOrder.indexOf(previousMode);
            const nextIndex = (currentIndex + 1) % readerUiModeOrder.length;
            const nextMode = readerUiModeOrder[nextIndex];

            try {
                localStorage.setItem(readerUiModeStorageKey, nextMode);
            } catch (_) {
            }

            return nextMode;
        });
    }

    return (
        <div className={`reader-shell reader-shell-atmosphere ui-mode-${uiMode} min-h-screen text-slate-900 flex flex-col ${shellClassName}`.trim()}>
            <header className="reader-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
                <div className="reader-header-inner mx-auto w-full px-4">
                    <div className="reader-header-main flex min-h-[46px] sm:min-h-[50px] items-center justify-between gap-2 sm:gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden sm:gap-3">
                            <Link to="/reader/home" className="reader-brand inline-flex items-center gap-2.5 min-w-0">
                                <span className="reader-brand-icon w-9 h-9 rounded-lg text-white font-bold text-sm flex items-center justify-center">P</span>
                                <span className="reader-brand-text min-w-0">
                                    <span className="block text-sm font-extrabold tracking-[0.1em] text-slate-900">PORTAL</span>
                                    <span className="reader-brand-sub block text-[10px] uppercase tracking-[0.12em] text-slate-500">{t('reader.header.tagline', 'Jendela berita harian')}</span>
                                </span>
                            </Link>

                            <span className="reader-date-chip hidden lg:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                                {todayLabel}
                            </span>
                        </div>

                        <div className="reader-header-actions flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                            <button
                                type="button"
                                className="reader-mode-toggle inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition sm:gap-2 sm:px-2.5 sm:text-xs"
                                onClick={cycleUiMode}
                                title={currentMode.label}
                            >
                                <CurrentModeIcon className="w-4 h-4" />
                                <span className="hidden xl:inline">{currentMode.label}</span>
                            </button>

                            <p className="reader-header-user-name hidden xl:block max-w-[180px] truncate text-sm font-semibold text-slate-700" title={displayName}>
                                {displayName}
                            </p>

                            <div className="reader-profile-menu-wrap relative" ref={profileMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsProfileMenuOpen((previous) => !previous)}
                                    className={`reader-avatar-button w-9 h-9 rounded-full overflow-hidden bg-slate-100 text-slate-700 font-semibold flex items-center justify-center ring-1 ring-slate-200 ${isProfileMenuOpen ? 'is-open' : ''}`.trim()}
                                    aria-label={t('reader.nav.settings', 'Pengaturan')}
                                    aria-haspopup="menu"
                                    aria-expanded={isProfileMenuOpen}
                                    aria-controls="reader-profile-menu"
                                    title={displayName}
                                >
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName || 'Avatar'} className="w-full h-full object-cover" />
                                    ) : avatarInitial}
                                </button>

                                {isProfileMenuOpen ? (
                                    <div
                                        id="reader-profile-menu"
                                        role="menu"
                                        className="reader-profile-menu absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                                    >
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleProfileMenuNavigate('/reader/home')}
                                            className="reader-profile-menu-item"
                                        >
                                            {t('reader.nav.home', 'Beranda')}
                                        </button>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleProfileMenuNavigate('/reader/bookmarks')}
                                            className="reader-profile-menu-item"
                                        >
                                            {t('reader.nav.bookmarks', 'Bookmark')}
                                        </button>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleProfileMenuNavigate('/reader/settings')}
                                            className="reader-profile-menu-item"
                                        >
                                            {t('reader.nav.settings', 'Pengaturan')}
                                        </button>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={handleProfileMenuLogout}
                                            className="reader-profile-menu-item"
                                        >
                                            {t('shell.logout', 'Keluar')}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="reader-main-area flex-1 min-h-0">
                <div ref={readingZoneRef} className="reader-reading-zone h-full overflow-y-auto">
                    <div ref={contentRef} className="reader-content-inner mx-auto w-full px-4 py-5 sm:py-6">
                        {(title || subtitle || action) ? (
                            <section className="reader-page-heading mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    {title ? <h1 className="reader-display truncate text-[clamp(1.6rem,2.4vw,2.2rem)] leading-tight font-semibold text-slate-900">{title}</h1> : null}
                                    {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
                                </div>
                                {action ? <div className="w-full sm:w-auto">{action}</div> : null}
                            </section>
                        ) : null}

                        <div className="reader-shell-content">
                            {children}
                        </div>

                        {!hideFooter && isPortalVariant ? (
                            <>
                                <div className="reader-footer-gap" aria-hidden="true" />
                                <footer className="reader-portal-footer rounded-none border border-slate-900 bg-[#081427] text-slate-100">
                                    <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
                                        <div>
                                            <div className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#1f6bf6] text-sm font-bold">P</div>
                                            <h4 className="mt-2 text-sm font-bold tracking-[0.12em]">PORTAL</h4>
                                            <p className="mt-2 text-xs leading-5 text-slate-300">
                                                {t('reader.footer.about', 'Portal berita terdepan untuk informasi terkini seputar teknologi, politik, ekonomi, olahraga, dan hiburan.')}
                                            </p>
                                        </div>

                                        <div>
                                            <h5 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">{t('reader.footer.navigation', 'Navigasi')}</h5>
                                            <ul className="mt-2 space-y-1.5 text-xs text-slate-200">
                                                <li><Link to="/reader/home" className="hover:text-white">{t('reader.nav.home', 'Beranda')}</Link></li>
                                                <li><Link to="/reader/home" className="hover:text-white">{t('reader.home.latestNews', 'Berita Terbaru')}</Link></li>
                                                <li><Link to="/reader/bookmarks" className="hover:text-white">{t('reader.nav.bookmarks', 'Bookmark')}</Link></li>
                                                <li><Link to="/reader/settings" className="hover:text-white">{t('reader.nav.settings', 'Pengaturan')}</Link></li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h5 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">{t('reader.home.categories', 'Kategori')}</h5>
                                            <ul className="mt-2 space-y-1.5 text-xs text-slate-200">
                                                {footerCategories.length ? footerCategories.map((cat) => (
                                                    <li key={cat.id}>{cat.name}</li>
                                                )) : (
                                                    <>
                                                        <li>{t('reader.category.technology', 'Teknologi')}</li>
                                                        <li>{t('reader.category.politics', 'Politik')}</li>
                                                        <li>{t('reader.category.economy', 'Ekonomi')}</li>
                                                        <li>{t('reader.category.sports', 'Olahraga')}</li>
                                                    </>
                                                )}
                                            </ul>
                                        </div>

                                        <div>
                                            <h5 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">{t('reader.footer.contact', 'Kontak')}</h5>
                                            <p className="mt-2 text-xs text-slate-200">portal@portal.com</p>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500">f</span>
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500">x</span>
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500">in</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-800 px-5 py-3 text-center text-[11px] text-slate-400 lg:px-8">
                                        © 2026 PORTAL. {t('reader.footer.rights', 'All rights reserved.')}
                                    </div>
                                </footer>
                            </>
                        ) : null}
                    </div>
                </div>
            </main>

            {!hideFooter && !isPortalVariant ? (
                <footer className="reader-footer border-t border-slate-200 bg-white/90">
                    <div className="reader-footer-inner mx-auto w-full px-4 py-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span>© 2026 PORTAL.</span>
                        <span>{t('reader.footer', 'Berita untuk pembaca digital.')}</span>
                    </div>
                </footer>
            ) : null}
        </div>
    );
}
