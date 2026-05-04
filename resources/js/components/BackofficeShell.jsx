import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { clearAuth, getToken, getUser } from '../lib/auth';
import { useI18n } from '../lib/i18n';

function LogoutIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
            <path d="M14.25 16.5 18.75 12l-4.5-4.5" />
            <path d="M18.75 12H9" />
            <path d="M10.5 20.25H5.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5h5.25" />
        </svg>
    );
}

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

const uiModeOrder = ['normal', 'night', 'read'];
const uiModeStorageKey = 'admin_ui_mode';

function buildUiModeMeta(t) {
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

function initials(name, fallback = 'A') {
    if (!name) return fallback;

    const chars = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '');
    return chars.join('') || fallback;
}

function readUiMode() {
    try {
        const saved = localStorage.getItem(uiModeStorageKey);
        if (saved && uiModeOrder.includes(saved)) {
            return saved;
        }
    } catch (_) {
    }

    return 'normal';
}

function resolveAvatarUrl(value) {
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) {
        return value;
    }

    if (value.startsWith('storage/')) {
        return `/${value}`;
    }

    return `/storage/${value.replace(/^\/+/, '')}`;
}

function resolveSettingsPath(role) {
    if (role === 'admin') {
        return '/admin/settings';
    }

    if (role === 'reviewer' || role === 'editor') {
        return '/editor/settings';
    }

    if (role === 'author') {
        return '/author/settings';
    }

    return '/welcome';
}

export default function BackofficeShell({
    title,
    subtitle,
    action,
    children,
    navItems,
    defaultDisplayName = 'Admin',
    defaultRoleLabel = 'admin',
    shellClassName = '',
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = getUser();
    const contentRef = useRef(null);
    const { t } = useI18n();

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('admin_sidebar_collapsed') === '1';
        } catch (_) {
            return false;
        }
    });

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [uiMode, setUiMode] = useState(readUiMode);

    const uiModeMeta = useMemo(() => buildUiModeMeta(t), [t]);
    const currentMode = useMemo(() => uiModeMeta[uiMode] || uiModeMeta.normal, [uiMode, uiModeMeta]);
    const CurrentModeIcon = currentMode.Icon;

    useEffect(() => {
        try {
            localStorage.setItem(uiModeStorageKey, uiMode);
        } catch (_) {
        }
    }, [uiMode]);

    useEffect(() => {
        try {
            localStorage.setItem('admin_sidebar_collapsed', isSidebarCollapsed ? '1' : '0');
        } catch (_) {
        }
    }, [isSidebarCollapsed]);

    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!isMobileSidebarOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileSidebarOpen]);

    useEffect(() => {
        const container = contentRef.current;
        if (!container) {
            return;
        }

        const targets = Array.from(container.children).filter((element) => element.tagName === 'SECTION');
        if (!targets.length) {
            return;
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        targets.forEach((target) => {
            target.classList.add('admin-scroll-reveal');

            if (prefersReducedMotion) {
                target.classList.add('is-visible');
            }
        });

        if (prefersReducedMotion) {
            return;
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
                root: container,
                threshold: 0.16,
                rootMargin: '0px 0px -8% 0px',
            }
        );

        targets.forEach((target) => observer.observe(target));

        return () => observer.disconnect();
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
            navigate('/');
        }
    }

    function cycleUiMode() {
        setUiMode((previousMode) => {
            const currentIndex = uiModeOrder.indexOf(previousMode);
            const nextIndex = (currentIndex + 1) % uiModeOrder.length;
            const nextMode = uiModeOrder[nextIndex];

            try {
                localStorage.setItem(uiModeStorageKey, nextMode);
            } catch (_) {
            }

            return nextMode;
        });
    }

    function toggleSidebar() {
        setIsSidebarCollapsed((previous) => !previous);
    }

    const displayName = user?.name || defaultDisplayName;
    const roleLabel = user?.role || defaultRoleLabel;
    const avatarInitial = initials(displayName, (defaultDisplayName[0] || 'A').toUpperCase());
    const avatarUrl = resolveAvatarUrl(user?.avatar || '');
    const settingsPath = resolveSettingsPath(user?.role || defaultRoleLabel);

    function openSettings() {
        navigate(settingsPath);
    }

    function resolveNavActive(item, isActive) {
        if (typeof item.isActive === 'function') {
            return item.isActive(location.pathname, isActive);
        }

        return isActive;
    }

    return (
        <div className={`admin-shell ui-mode-${uiMode} ${isSidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} h-screen overflow-hidden flex bg-[#f3f6fb] text-slate-800 ${shellClassName}`.trim()}>
            <aside
                aria-hidden={isSidebarCollapsed}
                className={`admin-sidebar hidden lg:flex shrink-0 h-screen text-slate-200 flex-col bg-gradient-to-b from-[#070f1f] via-[#07162e] to-[#081b39] overflow-hidden transition-[width,opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSidebarCollapsed ? 'w-0 opacity-0 -translate-y-5 pointer-events-none border-r-transparent' : 'w-64 opacity-100 translate-y-0 border-r-slate-900/60'}`}
            >
                <div className="h-16 px-5 border-b border-slate-700/50 flex items-center">
                    <button
                        type="button"
                        className="flex items-center gap-3 group"
                        onClick={toggleSidebar}
                        title={t('shell.hideSidebar', 'Sembunyikan panel kiri')}
                    >
                        <span className="w-7 h-7 rounded-md bg-blue-600/90 text-white flex items-center justify-center text-xs font-bold group-hover:bg-blue-500 transition">P</span>
                        <span>
                            <span className="block text-sm font-semibold tracking-wide text-white group-hover:text-blue-200 transition">PORTAL</span>
                            <span className="block text-xs text-slate-400 leading-none">{t('shell.adminPanel', 'Panel Backoffice')}</span>
                        </span>
                    </button>
                </div>

                <nav className="px-3 py-4 space-y-1.5 text-sm">
                    {navItems.map((item) => {
                        const Icon = item.Icon;

                        return (
                            <NavLink
                                key={item.label}
                                to={item.to}
                                end={Boolean(item.end)}
                                className={({ isActive }) => {
                                    const active = resolveNavActive(item, isActive);

                                    return `group flex items-center gap-2.5 px-3 py-2 rounded-md transition ${active ? 'bg-blue-700/35 text-white shadow-[inset_0_0_0_1px_rgba(59,130,246,0.35)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;
                                }}
                            >
                                <Icon className="w-4 h-4 text-slate-300 group-hover:text-slate-100" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 border-t border-slate-700/50">
                    <button
                        type="button"
                        className="w-full flex items-center justify-start gap-3 rounded-xl border border-slate-700/40 bg-[#091326] px-3.5 py-3 text-left cursor-pointer hover:border-blue-500/40 hover:bg-[#0d1f3a] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                        onClick={openSettings}
                        title={t('nav.common.settings', 'Pengaturan Akun')}
                        aria-label={t('nav.common.settings', 'Pengaturan Akun')}
                    >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-amber-200 text-amber-800 flex items-center justify-center text-sm font-bold shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : avatarInitial}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                            <p className="text-xs text-slate-400 capitalize">{roleLabel}</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-slate-700/60 bg-transparent text-slate-200 py-2 text-sm font-medium hover:bg-white/5 transition flex items-center justify-center gap-2"
                        onClick={logout}
                    >
                        <LogoutIcon className="w-4 h-4" />
                        {t('shell.logout', 'Keluar')}
                    </button>
                </div>
            </aside>

            <button
                type="button"
                aria-label={t('shell.closeSidebar', 'Tutup panel kiri')}
                className={`lg:hidden fixed inset-0 z-40 bg-slate-950/45 transition-opacity duration-300 ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMobileSidebarOpen(false)}
            />

            <aside
                aria-hidden={!isMobileSidebarOpen}
                className={`lg:hidden fixed top-0 left-0 z-50 h-screen w-[84vw] max-w-[320px] text-slate-200 flex flex-col bg-gradient-to-b from-[#070f1f] via-[#07162e] to-[#081b39] border-r border-slate-900/60 transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="h-16 px-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-md bg-blue-600/90 text-white flex items-center justify-center text-xs font-bold">P</span>
                        <span>
                            <span className="block text-sm font-semibold tracking-wide text-white">PORTAL</span>
                            <span className="block text-xs text-slate-400 leading-none">{t('shell.adminPanel', 'Panel Backoffice')}</span>
                        </span>
                    </div>

                    <button
                        type="button"
                        className="w-8 h-8 rounded-md border border-slate-700/60 text-slate-300 hover:text-white hover:bg-white/10 transition flex items-center justify-center"
                        onClick={() => setIsMobileSidebarOpen(false)}
                        aria-label={t('shell.closeMenu', 'Tutup menu')}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path d="M6 6l12 12" />
                            <path d="M18 6L6 18" />
                        </svg>
                    </button>
                </div>

                <nav className="px-3 py-4 space-y-1.5 text-sm">
                    {navItems.map((item) => {
                        const Icon = item.Icon;

                        return (
                            <NavLink
                                key={`mobile-${item.label}`}
                                to={item.to}
                                end={Boolean(item.end)}
                                className={({ isActive }) => {
                                    const active = resolveNavActive(item, isActive);

                                    return `group flex items-center gap-2.5 px-3 py-2 rounded-md transition ${active ? 'bg-blue-700/35 text-white shadow-[inset_0_0_0_1px_rgba(59,130,246,0.35)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;
                                }}
                            >
                                <Icon className="w-4 h-4 text-slate-300 group-hover:text-slate-100" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 border-t border-slate-700/50">
                    <button
                        type="button"
                        className="w-full flex items-center justify-start gap-3 rounded-xl border border-slate-700/40 bg-[#091326] px-3.5 py-3 text-left cursor-pointer hover:border-blue-500/40 hover:bg-[#0d1f3a] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                        onClick={openSettings}
                        title={t('nav.common.settings', 'Pengaturan Akun')}
                        aria-label={t('nav.common.settings', 'Pengaturan Akun')}
                    >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-amber-200 text-amber-800 flex items-center justify-center text-sm font-bold shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : avatarInitial}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                            <p className="text-xs text-slate-400 capitalize">{roleLabel}</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-slate-700/60 bg-transparent text-slate-200 py-2 text-sm font-medium hover:bg-white/5 transition flex items-center justify-center gap-2"
                        onClick={logout}
                    >
                        <LogoutIcon className="w-4 h-4" />
                        {t('shell.logout', 'Keluar')}
                    </button>
                </div>
            </aside>

            <main className="admin-main-area flex-1 min-w-0 h-screen overflow-hidden flex flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                <div className="h-16 border-b border-slate-200 bg-white px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex items-center gap-2.5 sm:gap-3">
                        <button
                            type="button"
                            className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition flex items-center justify-center shrink-0"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            aria-label={t('shell.openMenu', 'Buka menu')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <path d="M4 7h16" />
                                <path d="M4 12h16" />
                                <path d="M4 17h16" />
                            </svg>
                        </button>

                        {isSidebarCollapsed ? (
                            <button
                                type="button"
                                onClick={toggleSidebar}
                                className="hidden lg:flex items-center gap-2.5 group shrink-0"
                                title={t('shell.showSidebar', 'Tampilkan panel kiri')}
                            >
                                <span className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-bold group-hover:bg-blue-500 transition">P</span>
                                <span className="text-xs font-semibold tracking-[0.08em] text-slate-600 uppercase group-hover:text-blue-600 transition">Portal</span>
                            </button>
                        ) : null}

                        <h1 className="truncate text-base sm:text-lg lg:text-xl font-semibold text-slate-900">{title}</h1>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            className="admin-mode-toggle inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-slate-700 transition"
                            onClick={cycleUiMode}
                            title={currentMode.label}
                        >
                            <CurrentModeIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">{currentMode.label}</span>
                        </button>

                        <p className="hidden md:block text-xs text-slate-500">{t('shell.welcomeUser', 'Selamat datang, {name}', { name: displayName })}</p>

                        <button
                            type="button"
                            className="hidden sm:flex w-8 h-8 rounded-full overflow-hidden bg-slate-100 text-slate-600 items-center justify-center text-xs font-semibold ring-1 ring-transparent hover:ring-blue-400 transition"
                            onClick={openSettings}
                            title={t('nav.common.settings', 'Pengaturan Akun')}
                            aria-label={t('nav.common.settings', 'Pengaturan Akun')}
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : avatarInitial}
                        </button>
                    </div>
                </div>

                <div ref={contentRef} className="admin-reading-zone flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5 bg-[#f3f6fb]">
                    {(subtitle || action) ? (
                        <header className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between mb-4">
                            <div>
                                {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
                            </div>
                            {action ? <div className="w-full sm:w-auto max-w-full">{action}</div> : null}
                        </header>
                    ) : null}

                    {children}
                </div>
            </main>
        </div>
    );
}
