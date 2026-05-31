import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../css/app.css';
import App from './app.jsx';
import { ConfirmProvider } from './lib/confirm';
import { I18nProvider } from './lib/i18n';
import { NotificationProvider } from './lib/notify';

ReactDOM.createRoot(document.getElementById('app')).render(
    <I18nProvider>
        <NotificationProvider>
            <ConfirmProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ConfirmProvider>
        </NotificationProvider>
    </I18nProvider>
);
