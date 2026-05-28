import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken, getUser, bootstrapSession } from './lib/auth';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const InternalLoginPage = lazy(() => import('./pages/InternalLoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminArticlesPage = lazy(() => import('./pages/admin/AdminArticlesPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminAssignmentMatrixPage = lazy(() => import('./pages/admin/AdminAssignmentMatrixPage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));
const AdminFeedbackPage = lazy(() => import('./pages/admin/AdminFeedbackPage'));
const AdminPermissionsPage = lazy(() => import('./pages/admin/AdminPermissionsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

const EditorDashboardPage = lazy(() => import('./pages/editor/EditorDashboardPage'));
const EditorReviewPage = lazy(() => import('./pages/editor/EditorReviewPage'));
const EditorPublishedPage = lazy(() => import('./pages/editor/EditorPublishedPage'));
const EditorReviewDetailPage = lazy(() => import('./pages/editor/EditorReviewDetailPage'));
const EditorActivityPage = lazy(() => import('./pages/editor/EditorActivityPage'));
const EditorFeedbackPage = lazy(() => import('./pages/editor/EditorFeedbackPage'));
const EditorSettingsPage = lazy(() => import('./pages/editor/EditorSettingsPage'));

const AuthorDashboardPage = lazy(() => import('./pages/author/AuthorDashboardPage'));
const AuthorArticlesPage = lazy(() => import('./pages/author/AuthorArticlesPage'));
const AuthorArticleFormPage = lazy(() => import('./pages/author/AuthorArticleFormPage'));
const AuthorActivityPage = lazy(() => import('./pages/author/AuthorActivityPage'));
const AuthorFeedbackPage = lazy(() => import('./pages/author/AuthorFeedbackPage'));
const AuthorSettingsPage = lazy(() => import('./pages/author/AuthorSettingsPage'));

const ReaderHomePage = lazy(() => import('./pages/reader/ReaderHomePage'));
const ReaderArticleDetailPage = lazy(() => import('./pages/reader/ReaderArticleDetailPage'));
const ReaderBookmarksPage = lazy(() => import('./pages/reader/ReaderBookmarksPage'));
const ReaderSettingsPage = lazy(() => import('./pages/reader/ReaderSettingsPage'));

function RequireAuth({ children }) {
    const token = getToken();

    if (!token) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function RequireAdmin({ children }) {
    const token = getToken();
    const user = getUser();

    if (!token) {
        return <Navigate to="/" replace />;
    }

    if (user?.role !== 'admin') {
        return <Navigate to="/welcome" replace />;
    }

    return children;
}

function RequireReviewer({ children }) {
    const token = getToken();
    const user = getUser();

    if (!token) {
        return <Navigate to="/" replace />;
    }

    if (!user || (user.role !== 'reviewer' && user.role !== 'admin')) {
        return <Navigate to="/welcome" replace />;
    }

    return children;
}

function RequireAuthor({ children }) {
    const token = getToken();
    const user = getUser();

    if (!token) {
        return <Navigate to="/" replace />;
    }

    if (!user || (user.role !== 'author' && user.role !== 'admin')) {
        return <Navigate to="/welcome" replace />;
    }

    return children;
}

function RequireReader({ children }) {
    const token = getToken();
    const user = getUser();

    if (!token) {
        return <Navigate to="/" replace />;
    }

    if (!user || (user.role !== 'user' && user.role !== 'admin')) {
        return <Navigate to="/welcome" replace />;
    }

    return children;
}

export default function App() {
    useEffect(() => {
        // Verify session with server on app mount. Keeps client guards trustworthy.
        void bootstrapSession();
    }, []);

    return (
        <div style={{ fontFamily: 'Sora, sans-serif' }}>
            <Suspense fallback={null}>
                <Routes>
                    <Route path="/" element={<LoginPage />} />
                    <Route path="/internal/login" element={<InternalLoginPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/invite/:token" element={<RegisterPage />} />
                    <Route
                        path="/welcome"
                        element={(
                            <RequireAuth>
                                <WelcomePage />
                            </RequireAuth>
                        )}
                    />
                    <Route
                        path="/admin/dashboard"
                        element={(
                            <RequireAdmin>
                                <AdminDashboardPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/articles"
                        element={(
                            <RequireAdmin>
                                <AdminArticlesPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/categories"
                        element={(
                            <RequireAdmin>
                                <AdminCategoriesPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/users"
                        element={(
                            <RequireAdmin>
                                <AdminUsersPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/assignments"
                        element={(
                            <RequireAdmin>
                                <AdminAssignmentMatrixPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/activities"
                        element={(
                            <RequireAdmin>
                                <AdminActivityPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/feedback"
                        element={(
                            <RequireAdmin>
                                <AdminFeedbackPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/permissions"
                        element={(
                            <RequireAdmin>
                                <AdminPermissionsPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route
                        path="/admin/settings"
                        element={(
                            <RequireAdmin>
                                <AdminSettingsPage />
                            </RequireAdmin>
                        )}
                    />
                    <Route path="/editor" element={<Navigate to="/editor/review" replace />} />
                    <Route
                        path="/editor/dashboard"
                        element={(
                            <RequireReviewer>
                                <EditorDashboardPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route
                        path="/editor/review"
                        element={(
                            <RequireReviewer>
                                <EditorReviewPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route
                        path="/editor/review/:id"
                        element={(
                            <RequireReviewer>
                                <EditorReviewDetailPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route
                        path="/editor/published"
                        element={(
                            <RequireReviewer>
                                <EditorPublishedPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route
                        path="/editor/activities"
                        element={(
                            <RequireReviewer>
                                <EditorActivityPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route
                        path="/editor/feedback"
                        element={(
                            <RequireReviewer>
                                <EditorFeedbackPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route
                        path="/editor/settings"
                        element={(
                            <RequireReviewer>
                                <EditorSettingsPage />
                            </RequireReviewer>
                        )}
                    />
                    <Route path="/author" element={<Navigate to="/author/dashboard" replace />} />
                    <Route
                        path="/author/dashboard"
                        element={(
                            <RequireAuthor>
                                <AuthorDashboardPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route
                        path="/author/articles"
                        element={(
                            <RequireAuthor>
                                <AuthorArticlesPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route
                        path="/author/articles/create"
                        element={(
                            <RequireAuthor>
                                <AuthorArticleFormPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route
                        path="/author/articles/:id/edit"
                        element={(
                            <RequireAuthor>
                                <AuthorArticleFormPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route
                        path="/author/activities"
                        element={(
                            <RequireAuthor>
                                <AuthorActivityPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route
                        path="/author/feedback"
                        element={(
                            <RequireAuthor>
                                <AuthorFeedbackPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route
                        path="/author/settings"
                        element={(
                            <RequireAuthor>
                                <AuthorSettingsPage />
                            </RequireAuthor>
                        )}
                    />
                    <Route path="/reader" element={<Navigate to="/reader/home" replace />} />
                    <Route
                        path="/reader/home"
                        element={(
                            <RequireReader>
                                <ReaderHomePage />
                            </RequireReader>
                        )}
                    />
                    <Route
                        path="/reader/articles/:identifier"
                        element={(
                            <RequireReader>
                                <ReaderArticleDetailPage />
                            </RequireReader>
                        )}
                    />
                    <Route
                        path="/reader/bookmarks"
                        element={(
                            <RequireReader>
                                <ReaderBookmarksPage />
                            </RequireReader>
                        )}
                    />
                    <Route
                        path="/reader/settings"
                        element={(
                            <RequireReader>
                                <ReaderSettingsPage />
                            </RequireReader>
                        )}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>

        </div>
    );
}
