export function resolveMediaUrl(path, explicitUrl = '') {
    const preferred = String(explicitUrl || '').trim();
    if (preferred) {
        return preferred;
    }

    const value = String(path || '').trim();
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

export function articleImageUrl(article) {
    if (!article) {
        return '';
    }

    return resolveMediaUrl(article.featured_image, article.featured_image_url);
}

export function mediaItemUrl(item) {
    if (!item) {
        return '';
    }

    return resolveMediaUrl(item.file_path, item.url);
}
