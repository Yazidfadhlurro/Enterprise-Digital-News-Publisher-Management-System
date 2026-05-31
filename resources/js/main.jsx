// entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../css/app.css';
import App from './app.jsx';
import { ConfirmProvider } from './lib/confirm';
import { I18nProvider } from './lib/i18n';
import { NotificationProvider } from './lib/notify';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        console.error('App runtime error:', error);
        this.setState({ errorMessage: error?.message || String(error) });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} className="flex items-center justify-center bg-slate-100 p-4">
                    <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <h1 className="text-xl font-semibold text-slate-900">Halaman gagal dimuat</h1>
                        <p className="mt-2 text-sm text-slate-600">Terjadi kesalahan runtime pada aplikasi. Silakan refresh halaman.</p>
                        {this.state.errorMessage && (
                            <p className="mt-2 text-xs text-red-500 font-mono break-all">{this.state.errorMessage}</p>
                        )}
                        <button
                            type="button"
                            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            onClick={() => window.location.reload()}
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <I18nProvider>
                <NotificationProvider>
                    <ConfirmProvider>
                        <BrowserRouter>
                            <App />
                        </BrowserRouter>
                    </ConfirmProvider>
                </NotificationProvider>
            </I18nProvider>
        </AppErrorBoundary>
    </React.StrictMode>
);
