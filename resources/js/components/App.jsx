import React from 'react';

function App() {
    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-7xl mx-auto px-4">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Portal Berita - Laravel + React + PostgreSQL
                </h1>
                <p className="text-lg text-gray-600">
                    Setup berhasil! Aplikasi Laravel dengan React dan PostgreSQL sudah siap digunakan.
                </p>
                
                <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-2xl font-semibold mb-4">Status Konfigurasi:</h2>
                    <ul className="space-y-2">
                        <li className="flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            Laravel Framework
                        </li>
                        <li className="flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            React 18
                        </li>
                        <li className="flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            PostgreSQL Database
                        </li>
                        <li className="flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            Tailwind CSS
                        </li>
                        <li className="flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            Vite Build Tool
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default App;
