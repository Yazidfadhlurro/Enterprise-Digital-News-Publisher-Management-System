import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WelcomePage from './pages/WelcomePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminArticlesPage from './pages/admin/AdminArticlesPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAssignmentMatrixPage from './pages/admin/AdminAssignmentMatrixPage';
import AdminActivityPage from './pages/admin/AdminActivityPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminPermissionsPage from './pages/admin/AdminPermissionsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import EditorDashboardPage from './pages/editor/EditorDashboardPage';
import EditorReviewPage from './pages/editor/EditorReviewPage';
import EditorPublishedPage from './pages/editor/EditorPublishedPage';
import EditorReviewDetailPage from './pages/editor/EditorReviewDetailPage';
import EditorActivityPage from './pages/editor/EditorActivityPage';
import EditorFeedbackPage from './pages/editor/EditorFeedbackPage';
import EditorSettingsPage from './pages/editor/EditorSettingsPage';
import AuthorDashboardPage from './pages/author/AuthorDashboardPage';
import AuthorArticlesPage from './pages/author/AuthorArticlesPage';
import AuthorArticleFormPage from './pages/author/AuthorArticleFormPage';
import AuthorActivityPage from './pages/author/AuthorActivityPage';
import AuthorFeedbackPage from './pages/author/AuthorFeedbackPage';
import AuthorSettingsPage from './pages/author/AuthorSettingsPage';
import ReaderHomePage from './pages/reader/ReaderHomePage';
import ReaderArticleDetailPage from './pages/reader/ReaderArticleDetailPage';
import ReaderBookmarksPage from './pages/reader/ReaderBookmarksPage';
import ReaderSettingsPage from './pages/reader/ReaderSettingsPage';
import { getToken, getUser } from './lib/auth';

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
    return (
        <div style={{ fontFamily: 'Sora, sans-serif' }}>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
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

        </div>
    );
}
