import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { useNavigate, useParams } from 'react-router-dom';
import AuthorShell from '../../components/AuthorShell';
import RichToolbar, { useFieldFocus } from '../../components/RichToolbar';
import { apiRequest } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { normalizeRichText, sanitizeHtml, stripHtml } from '../../lib/html';
import { mediaItemUrl, resolveMediaUrl } from '../../lib/media';
import { useI18n } from '../../lib/i18n';

const TITLE_MAX = 120;
const MAX_TAGS = 5;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const AUTOSAVE_DEBOUNCE_MS = 1800;
const ADD_CATEGORY_OPTION = '__add_new_category__';

const FONT_FAMILIES = [
    'Calibri',
    'Arial',
    'Times New Roman',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Courier New',
];

const FONT_SIZES = ['11px', '12px', '14px', '16px', '18px', '24px', '32px'];
const DEFAULT_FONT_FAMILY = 'Calibri';
const DEFAULT_FONT_SIZE = '11px';

const FontSize = Extension.create({
    name: 'fontSize',

    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element) => element.style.fontSize || null,
                        renderHTML: (attributes) => {
                            if (!attributes.fontSize) {
                                return {};
                            }

                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize:
                (size) =>
                ({ chain }) =>
                    chain().setMark('textStyle', { fontSize: size }).run(),
            unsetFontSize:
                () =>
                ({ chain }) =>
                    chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
        };
    },
});

const defaultForm = {
    title: '',
    slug: '',
    category_id: '',
    excerpt: '',
    content: '',
    featured_image_alt: '',
};

const CONTENT_BLOCK_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
};

function createContentBlock(type = CONTENT_BLOCK_TYPES.TEXT) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        text: '<p></p>',
        url: '',
        file_path: '',
        media_url: '',
        alt_text: '',
    };
}

function moveArrayItem(items, fromIndex, toIndex) {
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

function buildComposedContent(blocks) {
    const blocksHtml = (blocks || []).map((block) => {
        if (block.type === CONTENT_BLOCK_TYPES.TEXT) {
            return normalizeRichText(block.text || '');
        }

        if (block.type === CONTENT_BLOCK_TYPES.IMAGE) {
            const source = block.url?.trim() || resolveMediaUrl(block.file_path, block.media_url);
            if (!source) return '';
            const alt = escapeHtml(block.alt_text || 'Gambar konten');
            return `<p><img src="${escapeHtml(source)}" alt="${alt}" /></p>`;
        }

        const source = block.url?.trim() || resolveMediaUrl(block.file_path, block.media_url);
        if (!source) return '';
        return `<p><video controls preload="metadata" src="${escapeHtml(source)}"></video></p>`;
    }).filter(Boolean).join('');

    return blocksHtml;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sortCategories(items) {
    return [...(items || [])].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'id'));
}

function formatDateTime(value, localeTag = 'id-ID') {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString(localeTag, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AuthorArticleFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { t } = useI18n();
    const fileInputRef = useRef(null);
    const imagePreviewUrlRef = useRef(null);
    const noticeTimerRef = useRef(null);
    const autosaveTimerRef = useRef(null);
    const autosaveInitializedRef = useRef(false);

    const [loading, setLoading] = useState(Boolean(id));
    const [saving, setSaving] = useState(false);
    const [autosaving, setAutosaving] = useState(false);
    const [lastAutosaveAt, setLastAutosaveAt] = useState('');
    const [centerNotice, setCenterNotice] = useState('');
    const [imageError, setImageError] = useState('');
    const [form, setForm] = useState(defaultForm);
    const [categories, setCategories] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState([]);
    const [slugManual, setSlugManual] = useState(false);
    const [featuredImagePath, setFeaturedImagePath] = useState('');
    const [featuredImageLabel, setFeaturedImageLabel] = useState('');
    const [localImagePreview, setLocalImagePreview] = useState('');
    const [mediaItems, setMediaItems] = useState([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaUploading, setMediaUploading] = useState(false);
    const [selectedMediaId, setSelectedMediaId] = useState(null);
    const [versions, setVersions] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [categoryError, setCategoryError] = useState('');
    const [categorySaving, setCategorySaving] = useState(false);
    const [isCategoryCreatorOpen, setIsCategoryCreatorOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDescription, setNewCategoryDescription] = useState('');
    const [featuredImageUrl, setFeaturedImageUrl] = useState('');
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [contentBlocks, setContentBlocks] = useState([createContentBlock(CONTENT_BLOCK_TYPES.TEXT)]);
    const [draggingBlockId, setDraggingBlockId] = useState(null);
    const [activeTextBlockId, setActiveTextBlockId] = useState(null);

    const isEdit = useMemo(() => Boolean(id), [id]);
    const { focusedField, handleFocus, handleBlur, isFieldFocused } = useFieldFocus();

    function showCenterNotice(message) {
        if (!message) {
            return;
        }

        setCenterNotice(String(message));
    }

    function revokeLocalImagePreview() {
        if (imagePreviewUrlRef.current) {
            URL.revokeObjectURL(imagePreviewUrlRef.current);
            imagePreviewUrlRef.current = null;
        }
    }

    function clearLocalImagePreview() {
        revokeLocalImagePreview();
        setLocalImagePreview('');
    }

    function clearFeaturedImageSelection() {
        clearLocalImagePreview();
        setFeaturedImagePath('');
        setFeaturedImageUrl('');
        setFeaturedImageLabel('');
        setSelectedMediaId(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    function setLocalImagePreviewFromFile(file) {
        clearLocalImagePreview();
        const objectUrl = URL.createObjectURL(file);
        imagePreviewUrlRef.current = objectUrl;
        setLocalImagePreview(objectUrl);
    }

    useEffect(() => () => {
        revokeLocalImagePreview();
    }, []);

    useEffect(() => {
        if (!centerNotice) {
            return;
        }

        if (noticeTimerRef.current) {
            clearTimeout(noticeTimerRef.current);
        }

        noticeTimerRef.current = setTimeout(() => {
            setCenterNotice('');
            noticeTimerRef.current = null;
        }, 2600);

        return () => {
            if (noticeTimerRef.current) {
                clearTimeout(noticeTimerRef.current);
                noticeTimerRef.current = null;
            }
        };
    }, [centerNotice]);

    async function loadCategories() {
        const token = getToken();

        try {
            const payload = await apiRequest('/author/categories', { token });
            if (payload?.status === 'success') {
                setCategories(sortCategories(payload?.data?.categories || []));
            }
        } catch (_) {
            setCategories([]);
        }
    }

    useEffect(() => {
        loadCategories();
    }, []);

    async function loadMediaLibrary() {
        const token = getToken();
        setMediaLoading(true);

        try {
            const payload = await apiRequest('/author/media', { token });
            if (payload?.status === 'success') {
                setMediaItems(payload?.data?.media || []);
            }
        } catch (_) {
            setMediaItems([]);
        } finally {
            setMediaLoading(false);
        }
    }

    async function loadVersions(articleId = id) {
        if (!articleId) {
            setVersions([]);
            return;
        }

        const token = getToken();
        setVersionsLoading(true);

        try {
            const payload = await apiRequest(`/author/articles/${articleId}/versions`, { token });
            if (payload?.status === 'success') {
                setVersions(payload?.data?.versions || []);
            }
        } catch (_) {
            setVersions([]);
        } finally {
            setVersionsLoading(false);
        }
    }

    function hydrateArticle(article) {
        clearLocalImagePreview();
        const mainText = normalizeRichText(article?.content || '');
        const mainBlockId = `${Date.now()}-main`;
        setContentBlocks([
            {
                ...createContentBlock(CONTENT_BLOCK_TYPES.TEXT),
                id: mainBlockId,
                text: mainText,
            },
        ]);
        setActiveTextBlockId(mainBlockId);
        setForm({
            title: article?.title || '',
            slug: article?.slug || '',
            category_id: article?.category_id ? String(article.category_id) : '',
            excerpt: article?.excerpt || '',
            content: normalizeRichText(article?.content || ''),
            featured_image_alt: article?.featured_image_alt || '',
        });
        setSlugManual(Boolean(article?.slug));
        setFeaturedImagePath(article?.featured_image || '');
        setFeaturedImageUrl(article?.featured_image_url || '');
        const imagePath = article?.featured_image || '';
        setFeaturedImageLabel(imagePath ? imagePath.split('/').pop() : '');
        setSelectedMediaId(null);
        setTags(Array.isArray(article?.tags) ? article.tags : []);
        setTagInput('');
        setCategoryError('');
        setIsCategoryCreatorOpen(false);
        setNewCategoryName('');
        setNewCategoryDescription('');
        const initialBlock = createContentBlock(CONTENT_BLOCK_TYPES.TEXT);
        setContentBlocks([initialBlock]);
        setActiveTextBlockId(initialBlock.id);
    }

    useEffect(() => {
        loadMediaLibrary();
    }, []);

    useEffect(() => {
        if (!isEdit) {
            return;
        }

        async function loadDetail() {
            const token = getToken();
            setCenterNotice('');
            setLoading(true);

            try {
                const payload = await apiRequest(`/author/articles/${id}`, { token });

                if (payload?.status !== 'success') {
                    throw new Error(payload?.message || t('author.form.errorLoadDetail', 'Gagal memuat detail berita.'));
                }

                const article = payload?.data?.article;
                hydrateArticle(article);
                await loadVersions(id);
                autosaveInitializedRef.current = false;
            } catch (err) {
                showCenterNotice(err.message || t('author.form.errorLoadDetailDefault', 'Terjadi kesalahan saat memuat detail berita.'));
            } finally {
                setLoading(false);
            }
        }

        loadDetail();
    }, [id, isEdit]);

    useEffect(() => {
        if (!isEdit || loading) {
            return;
        }

        if (!autosaveInitializedRef.current) {
            autosaveInitializedRef.current = true;
            return;
        }

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = setTimeout(async () => {
            const token = getToken();
            setAutosaving(true);

            try {
                const payload = await apiRequest(`/author/articles/${id}/autosave`, {
                    method: 'POST',
                    token,
                    body: {
                        title: form.title.trim(),
                        slug: form.slug || null,
                        category_id: form.category_id ? Number(form.category_id) : null,
                        excerpt: form.excerpt.trim() || null,
                        content: buildComposedContent(contentBlocks),
                        featured_image: featuredImagePath || null,
                        featured_image_alt: form.featured_image_alt?.trim() || null,
                    },
                });

                if (payload?.status === 'success') {
                    setLastAutosaveAt(payload?.data?.autosaved_at || new Date().toISOString());
                    await loadVersions(id);
                }
            } catch (_) {
            } finally {
                setAutosaving(false);
            }
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        };
    }, [
        isEdit,
        id,
        loading,
        form.title,
        form.slug,
        form.category_id,
        form.excerpt,
        contentBlocks,
        form.featured_image_alt,
        featuredImagePath,
    ]);

    function handleChange(event) {
        const { name, value } = event.target;

        if (name === 'title') {
            const nextTitle = value.slice(0, TITLE_MAX);
            setForm((previous) => ({
                ...previous,
                title: nextTitle,
                slug: slugManual ? previous.slug : slugify(nextTitle),
            }));
            return;
        }

        if (name === 'slug') {
            setSlugManual(true);
            setForm((previous) => ({
                ...previous,
                slug: slugify(value),
            }));
            return;
        }

        if (name === 'featured_image_alt') {
            setImageError('');
        }

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function handleContentChange(value) {
        if (!activeTextBlockId) return;
        updateContentBlock(activeTextBlockId, { text: value });
    }

    function handleCategorySelectChange(event) {
        const value = event.target.value;
        setCategoryError('');

        if (value === ADD_CATEGORY_OPTION) {
            setIsCategoryCreatorOpen(true);
            setForm((previous) => ({
                ...previous,
                category_id: '',
            }));
            return;
        }

        setIsCategoryCreatorOpen(false);
        setNewCategoryName('');
        setNewCategoryDescription('');
        setForm((previous) => ({
            ...previous,
            category_id: value,
        }));
    }

    async function createCategoryManual() {
        const cleanName = newCategoryName.trim();
        const cleanDescription = newCategoryDescription.trim();

        if (!cleanName) {
            const message = t('author.form.errorCategoryNameRequired', 'Nama kategori wajib diisi.');
            setCategoryError(message);
            showCenterNotice(message);
            return;
        }

        const token = getToken();
        setCategorySaving(true);
        setCategoryError('');

        try {
            const payload = await apiRequest('/author/categories', {
                method: 'POST',
                token,
                body: {
                    name: cleanName,
                    description: cleanDescription || null,
                },
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('author.form.errorCategoryCreate', 'Gagal menambahkan kategori baru.'));
            }

            const createdCategory = payload?.data?.category;
            if (!createdCategory?.id) {
                throw new Error(t('author.form.errorCategoryInvalid', 'Kategori baru tidak valid.'));
            }

            setCategories((previous) => sortCategories([...previous, createdCategory]));
            setForm((previous) => ({
                ...previous,
                category_id: String(createdCategory.id),
            }));
            setIsCategoryCreatorOpen(false);
            setNewCategoryName('');
            setNewCategoryDescription('');
            setCategoryError('');
        } catch (err) {
            const message = err.message || t('author.form.errorCategoryCreateDefault', 'Terjadi kesalahan saat menambahkan kategori.');
            setCategoryError(message);
            showCenterNotice(message);
        } finally {
            setCategorySaving(false);
        }
    }

    function addTag() {
        const nextTag = tagInput.trim();

        if (!nextTag) {
            return;
        }

        if (tags.includes(nextTag) || tags.length >= MAX_TAGS) {
            setTagInput('');
            return;
        }

        setTags((previous) => [...previous, nextTag]);
        setTagInput('');
    }

    function removeTag(tag) {
        setTags((previous) => previous.filter((item) => item !== tag));
    }

    function onTagInputKeyDown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addTag();
        }
    }

    function triggerFilePicker() {
        fileInputRef.current?.click();
    }

    function handleImageDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!mediaUploading) {
            setIsDraggingImage(true);
        }
    }

    function handleImageDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingImage(false);
    }

    async function processImageFile(file) {
        setImageError('');

        if (!file) {
            return;
        }

        const validTypes = ['image/png', 'image/jpeg', 'image/webp'];

        if (!validTypes.includes(file.type)) {
            const message = t('author.form.errorImageFormat', 'Format gambar harus PNG, JPG, atau WEBP.');
            setImageError(message);
            showCenterNotice(message);
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            const message = t('author.form.errorImageSize', 'Ukuran gambar maksimal 4MB.');
            setImageError(message);
            showCenterNotice(message);
            return;
        }

        setFeaturedImageLabel(file.name);
        setLocalImagePreviewFromFile(file);

        await uploadMedia(file);
    }

    async function handleImageDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingImage(false);

        if (mediaUploading) {
            return;
        }

        const file = event.dataTransfer?.files?.[0];
        if (file) {
            await processImageFile(file);
        }
    }

    async function uploadMediaAsset(file, altText = '') {
        const token = getToken();
        setMediaUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (altText) {
                formData.append('alt_text', altText);
            }

            const payload = await apiRequest('/author/media', {
                method: 'POST',
                token,
                body: formData,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('author.form.errorImageUpload', 'Gagal mengunggah media.'));
            }

            await loadMediaLibrary();
            return payload?.data?.media || null;
        } catch (err) {
            throw err;
        } finally {
            setMediaUploading(false);
        }
    }

    async function uploadMedia(file) {
        const altText = form.featured_image_alt?.trim() || '';

        if (!altText) {
            const message = t('author.form.errorImageAlt', 'Isi alt text gambar terlebih dahulu sebelum upload media.');
            setImageError(message);
            showCenterNotice(message);
            return;
        }

        try {
            const media = await uploadMediaAsset(file, altText);
            setFeaturedImagePath(media?.file_path || '');
            setFeaturedImageUrl(media?.url || '');
            setFeaturedImageLabel(media?.file_name || media?.file_path || '');
            setSelectedMediaId(media?.id ? Number(media.id) : null);
            showCenterNotice(t('author.form.mediaUploaded', 'Media berhasil diunggah dan dipilih sebagai featured image.'));
        } catch (err) {
            const message = err.message || t('author.form.errorImageUploadDefault', 'Terjadi kesalahan saat mengunggah media.');
            setImageError(message);
            showCenterNotice(message);
        }
    }

    async function onImageSelected(event) {
        const file = event.target.files?.[0];
        await processImageFile(file);

        if (event.target) {
            event.target.value = '';
        }
    }

    function resetChanges() {
        setCategoryError('');
        setIsCategoryCreatorOpen(false);
        setNewCategoryName('');
        setNewCategoryDescription('');

        if (isEdit) {
            setLoading(true);
            setCenterNotice('');
            setImageError('');

            (async () => {
                try {
                    const token = getToken();
                    const payload = await apiRequest(`/author/articles/${id}`, { token });

                    if (payload?.status !== 'success') {
                        throw new Error(payload?.message || t('author.form.errorReload', 'Gagal memuat ulang data berita.'));
                    }

                    const article = payload?.data?.article;
                    hydrateArticle(article);
                    await loadVersions(id);
                    autosaveInitializedRef.current = false;
                } catch (err) {
                    showCenterNotice(err.message || t('author.form.errorReloadDefault', 'Terjadi kesalahan saat memuat ulang data berita.'));
                } finally {
                    setLoading(false);
                }
            })();

            return;
        }

        setForm({ ...defaultForm });
        setTags([]);
        setTagInput('');
        clearFeaturedImageSelection();
        setSlugManual(false);
        setCenterNotice('');
        setImageError('');
        setLastAutosaveAt('');
        const initialBlock = createContentBlock(CONTENT_BLOCK_TYPES.TEXT);
        setContentBlocks([initialBlock]);
        setActiveTextBlockId(initialBlock.id);
    }

    function openPreview() {
        const previewWindow = window.open('', '_blank', 'noopener,noreferrer');

        if (!previewWindow) {
            return;
        }

        const title = escapeHtml(form.title || t('author.form.previewTitleDefault', 'Pratinjau Berita'));
        const excerpt = escapeHtml(form.excerpt || '');
        const normalizedContent = normalizeRichText(buildComposedContent(contentBlocks));
        const safeContent = sanitizeHtml(normalizedContent);
        const contentText = stripHtml(normalizedContent);
        const previewImage = localImagePreview || resolveMediaUrl(featuredImagePath, featuredImageUrl);
        const previewAlt = escapeHtml(form.featured_image_alt || form.title || 'Gambar unggulan');
        const contentHtml = contentText.trim()
            ? safeContent
            : `<p>${escapeHtml(t('author.form.previewEmptyContent', 'Konten belum tersedia.'))}</p>`;

        previewWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 820px; margin: 36px auto; padding: 0 20px; color: #0f172a; line-height: 1.75; }
                        h1 { font-size: 34px; line-height: 1.15; margin: 0 0 12px; }
                        p.excerpt { color: #475569; margin: 0 0 20px; }
                        .meta { font-size: 12px; color: #64748b; margin-bottom: 18px; }
                        .cover { width: 100%; height: auto; border-radius: 14px; margin: 12px 0 22px; }
                        .content h2 { font-size: 24px; margin: 1.2rem 0 0.5rem; }
                        .content h3 { font-size: 20px; margin: 1rem 0 0.5rem; }
                        .content ul, .content ol { padding-left: 1.3rem; margin: 0.6rem 0; }
                        .content blockquote { border-left: 3px solid #e2e8f0; margin: 0.9rem 0; padding-left: 12px; color: #475569; font-style: italic; }
                        .content a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; }
                        .content mark { background: #fde68a; color: inherit; }
                        .content .ql-align-center { text-align: center; }
                        .content .ql-align-right { text-align: right; }
                        .content .ql-align-justify { text-align: justify; }
                        .content .ql-indent-1 { padding-left: 1.5rem; }
                        .content .ql-indent-2 { padding-left: 3rem; }
                        .content { white-space: normal; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p class="excerpt">${excerpt}</p>
                    <p class="meta">Slug: ${escapeHtml(form.slug || '-')}</p>
                    ${previewImage ? `<img class="cover" src="${previewImage}" alt="${previewAlt}" />` : ''}
                    <div class="content">${contentHtml}</div>
                </body>
            </html>
        `);
        previewWindow.document.close();
    }

    const contentPlainText = useMemo(() => stripHtml(buildComposedContent(contentBlocks)), [contentBlocks]);

    async function submitForm(targetStatus) {
        const status = targetStatus || 'draft';

        if (!form.title.trim() || !contentPlainText.trim() || !form.category_id) {
            showCenterNotice(t('author.form.errorRequiredMain', 'Judul, kategori, dan konten wajib diisi.'));
            return;
        }

        const token = getToken();
        const body = {
            title: form.title.trim(),
            slug: form.slug || null,
            category_id: form.category_id ? Number(form.category_id) : null,
            excerpt: form.excerpt.trim() || null,
            content: buildComposedContent(contentBlocks),
            status,
            featured_image: featuredImagePath || null,
            featured_image_alt: form.featured_image_alt?.trim() || null,
            tags,
        };

        setSaving(true);
        setCenterNotice('');

        try {
            const endpoint = isEdit ? `/author/articles/${id}` : '/author/articles';
            const method = isEdit ? 'PUT' : 'POST';

            const payload = await apiRequest(endpoint, {
                method,
                token,
                body,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('author.form.errorSave', 'Gagal menyimpan berita.'));
            }

            navigate('/author/articles', { replace: true });
        } catch (err) {
            showCenterNotice(err.message || t('author.form.errorSaveDefault', 'Terjadi kesalahan saat menyimpan berita.'));
        } finally {
            setSaving(false);
        }
    }

    const seoChecks = useMemo(() => {
        const titleLength = form.title.trim().length;
        const excerptLength = form.excerpt.trim().length;
        const contentLength = contentPlainText.trim().length;
        const altLength = form.featured_image_alt.trim().length;

        const items = [
            {
                key: 'title',
                label: t('author.form.seoTitleLength', 'Judul 45-65 karakter'),
                passed: titleLength >= 45 && titleLength <= 65,
            },
            {
                key: 'slug',
                label: t('author.form.seoSlug', 'Slug terisi'),
                passed: form.slug.trim().length > 0,
            },
            {
                key: 'excerpt',
                label: t('author.form.seoExcerpt', 'Ringkasan minimal 120 karakter'),
                passed: excerptLength >= 120,
            },
            {
                key: 'content',
                label: t('author.form.seoContent', 'Konten minimal 800 karakter'),
                passed: contentLength >= 800,
            },
            {
                key: 'media',
                label: t('author.form.seoImage', 'Gambar unggulan + teks alternatif tersedia'),
                passed: Boolean(featuredImagePath) && altLength >= 8,
            },
        ];

        const score = Math.round((items.filter((item) => item.passed).length / items.length) * 100);

        return {
            score,
            items,
        };
    }, [form.title, form.slug, form.excerpt, contentPlainText, form.featured_image_alt, featuredImagePath, t]);

    const autosaveText = useMemo(() => {
        if (!isEdit) return '';
        if (autosaving) return t('author.form.autosaving', 'Simpan otomatis...');
        if (lastAutosaveAt) return t('author.form.autosaveAt', 'Simpan otomatis terakhir: {time}', { time: formatDateTime(lastAutosaveAt) });
        return t('author.form.autosaveIdle', 'Simpan otomatis aktif');
    }, [autosaving, isEdit, lastAutosaveAt, t]);

    const activeTextBlock = useMemo(
        () => contentBlocks.find((block) => block.id === activeTextBlockId) || null,
        [contentBlocks, activeTextBlockId]
    );

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            FontFamily,
            FontSize,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: t('author.form.contentPlaceholder', 'Tulis konten berita lengkap di sini...'),
            }),
        ],
        content: activeTextBlock?.text || '<p></p>',
        onCreate: ({ editor: nextEditor }) => {
            if (nextEditor.isEmpty) {
                nextEditor.chain().setFontFamily(DEFAULT_FONT_FAMILY).run();
                nextEditor.commands.setFontSize(DEFAULT_FONT_SIZE);
            }
        },
        onUpdate: ({ editor: nextEditor }) => {
            handleContentChange(nextEditor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'author-rich-editor-content',
                style: `font-family: ${DEFAULT_FONT_FAMILY}, 'Segoe UI', Arial, sans-serif; font-size: ${DEFAULT_FONT_SIZE};`,
            },
        },
    }, []);

    useEffect(() => {
        if (!editor) return;
        const normalized = normalizeRichText(activeTextBlock?.text || '');
        const expected = normalized || '<p></p>';
        if (editor.getHTML() === expected) return;
        editor.commands.setContent(expected, false);
    }, [editor, activeTextBlock?.id, activeTextBlock?.text]);

    function promptForLink() {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link')?.href || '';
        const nextUrl = window.prompt(t('author.form.linkPrompt', 'Masukkan URL'), previousUrl);

        if (nextUrl === null) {
            return;
        }

        const trimmed = nextUrl.trim();

        if (!trimmed) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({
            href: trimmed,
            target: '_blank',
            rel: 'noopener noreferrer',
        }).run();
    }

    function clearFormatting() {
        if (!editor) return;
        editor.chain().focus().unsetAllMarks().clearNodes().run();
    }


    const featuredPreview = localImagePreview || resolveMediaUrl(featuredImagePath, featuredImageUrl);

    async function deleteMediaItem(mediaId) {
        const idValue = Number(mediaId);
        if (!idValue || Number.isNaN(idValue)) {
            return;
        }

        if (!window.confirm(t('author.form.confirmDeleteMedia', 'Hapus media ini dari pustaka?'))) {
            return;
        }

        const token = getToken();
        setCenterNotice('');

        try {
            const payload = await apiRequest(`/author/media/${idValue}`, {
                method: 'DELETE',
                token,
            });

            if (payload?.status !== 'success') {
                throw new Error(payload?.message || t('author.form.errorDeleteMedia', 'Gagal menghapus media.'));
            }

            setMediaItems((previous) => previous.filter((item) => Number(item.id) !== idValue));

            if (Number(selectedMediaId) === idValue) {
                clearFeaturedImageSelection();
            }

            showCenterNotice(t('author.form.mediaDeleted', 'Media berhasil dihapus.'));
        } catch (err) {
            showCenterNotice(err.message || t('author.form.errorDeleteMediaDefault', 'Terjadi kesalahan saat menghapus media.'));
        }
    }

    function addContentBlock(type) {
        const nextBlock = createContentBlock(type);
        setContentBlocks((previous) => [...previous, nextBlock]);
        if (type === CONTENT_BLOCK_TYPES.TEXT) {
            setActiveTextBlockId(nextBlock.id);
        }
    }

    function updateContentBlock(blockId, updates) {
        setContentBlocks((previous) => previous.map((block) => (
            block.id === blockId ? { ...block, ...updates } : block
        )));
    }

    function removeContentBlock(blockId) {
        setContentBlocks((previous) => {
            if (previous.length <= 1) return previous;
            return previous.filter((block) => block.id !== blockId);
        });
    }

    async function uploadBlockMedia(block, file) {
        if (!file) return;

        const isImage = String(file.type || '').startsWith('image/');
        const isVideo = String(file.type || '').startsWith('video/');

        if (!isImage && !isVideo) {
            showCenterNotice(t('author.form.errorMediaFormat', 'File harus berupa gambar atau video.'));
            return;
        }

        if (isImage && file.size > MAX_IMAGE_SIZE) {
            showCenterNotice(t('author.form.errorImageSize', 'Ukuran gambar maksimal 4MB.'));
            return;
        }

        if (isVideo && file.size > 20 * 1024 * 1024) {
            showCenterNotice(t('author.form.errorVideoSize', 'Ukuran video maksimal 20MB.'));
            return;
        }

        try {
            const media = await uploadMediaAsset(file, isImage ? (block.alt_text?.trim() || 'media') : '');
            updateContentBlock(block.id, {
                file_path: media?.file_path || '',
                media_url: media?.url || '',
                url: media?.url || media?.file_path || '',
            });
            showCenterNotice(t('author.form.mediaUploaded', 'Media berhasil diunggah dan dipilih sebagai featured image.'));
        } catch (err) {
            showCenterNotice(err.message || t('author.form.errorImageUploadDefault', 'Terjadi kesalahan saat mengunggah media.'));
        }
    }

    function handleBlockDragStart(blockId) {
        setDraggingBlockId(blockId);
    }

    function handleBlockDrop(targetBlockId) {
        if (!draggingBlockId || draggingBlockId === targetBlockId) {
            setDraggingBlockId(null);
            return;
        }

        setContentBlocks((previous) => {
            const fromIndex = previous.findIndex((item) => item.id === draggingBlockId);
            const toIndex = previous.findIndex((item) => item.id === targetBlockId);
            if (fromIndex < 0 || toIndex < 0) return previous;
            return moveArrayItem(previous, fromIndex, toIndex);
        });
        setDraggingBlockId(null);
    }

    useEffect(() => {
        if (!contentBlocks.length) {
            setActiveTextBlockId(null);
            return;
        }

        const activeExists = activeTextBlockId
            ? contentBlocks.some((block) => block.id === activeTextBlockId && block.type === CONTENT_BLOCK_TYPES.TEXT)
            : false;

        if (activeExists) return;

        const firstTextBlock = contentBlocks.find((block) => block.type === CONTENT_BLOCK_TYPES.TEXT);
        setActiveTextBlockId(firstTextBlock ? firstTextBlock.id : null);
    }, [contentBlocks, activeTextBlockId]);

    return (
        <AuthorShell title={isEdit ? t('author.form.titleEdit', 'Edit Berita') : t('author.form.titleCreate', 'Buat Berita Baru')}>
            {centerNotice ? (
                <div className="author-center-notice-wrap" role="alert" aria-live="assertive">
                    <div className="author-center-notice rounded-xl border px-5 py-3 text-sm font-semibold">
                        {centerNotice}
                    </div>
                </div>
            ) : null}

            {loading ? (
                <section className="author-form-loading rounded-lg border border-slate-200 bg-white p-5 shadow-sm text-sm">
                    {t('author.form.loadingDetail', 'Memuat detail berita...')}
                </section>
            ) : (
                <div className="author-form-page">
                    <section className="author-form-layout mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_248px] gap-4 items-start">
                        <div className="space-y-4">
                            <article className="author-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <label className="author-form-label block">{t('author.form.fieldTitle', 'Judul Berita *')}</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    onFocus={() => handleFocus('title')}
                                    onBlur={() => handleBlur('title')}
                                    placeholder={t('author.form.fieldTitlePlaceholder', 'Tulis judul berita yang menarik perhatian...')}
                                    className="author-form-input author-form-input-title w-full rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-sm"
                                    maxLength={TITLE_MAX}
                                    required
                                />
                                {isFieldFocused('title') && <div className="rt-field-hint">{t('author.form.hintTitle', 'Gunakan 45-65 karakter untuk SEO optimal')}</div>}
                                <p className="author-form-counter mt-2.5 text-right">{t('author.form.characterCount', '{count} / {max} karakter', { count: form.title.length, max: TITLE_MAX })}</p>
                            </article>

                            <article className="author-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <label className="author-form-label block">{t('author.form.fieldSlug', 'Slug URL')}</label>
                                <div className="author-slug-wrap mt-1.5 flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                                    <span className="author-slug-prefix px-3 py-3 bg-slate-50 border-r border-slate-200 text-xs">portal.com/berita/</span>
                                    <input
                                        type="text"
                                        name="slug"
                                        value={form.slug}
                                        onChange={handleChange}
                                        onFocus={() => handleFocus('slug')}
                                        onBlur={() => handleBlur('slug')}
                                        placeholder={t('author.form.fieldSlugPlaceholder', 'url-artikel')}
                                        className="author-form-input flex-1 min-w-0 px-3 py-3 text-sm"
                                    />
                                </div>
                            </article>

                            <article className="author-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <label className="author-form-label block">{t('author.form.fieldFeaturedImage', 'Gambar Unggulan *')}</label>
                                <input
                                    type="text"
                                    name="featured_image_alt"
                                    value={form.featured_image_alt}
                                    onChange={handleChange}
                                    onFocus={() => handleFocus('featured_image_alt')}
                                    onBlur={() => handleBlur('featured_image_alt')}
                                    placeholder={t('author.form.fieldFeaturedImageAlt', 'Teks alternatif gambar (wajib untuk SEO)')}
                                    className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm mt-1.5"
                                />
                                {isFieldFocused('featured_image_alt') && <div className="rt-field-hint">{t('author.form.hintAlt', 'Deskripsi gambar minimal 8 karakter untuk aksesibilitas')}</div>}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={onImageSelected}
                                />
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        if (!mediaUploading) {
                                            triggerFilePicker();
                                        }
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            triggerFilePicker();
                                        }
                                    }}
                                    onDragOver={handleImageDragOver}
                                    onDragLeave={handleImageDragLeave}
                                    onDrop={handleImageDrop}
                                    className={`author-image-dropzone mt-1.5 w-full rounded-lg border border-dashed px-4 py-11 text-center transition cursor-pointer ${isDraggingImage ? 'is-dragging' : ''} ${mediaUploading ? 'opacity-60 pointer-events-none' : ''}`}
                                    aria-disabled={mediaUploading}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="author-image-icon w-8 h-8 mx-auto">
                                        <path d="M12 16V6" />
                                        <path d="m7.75 10.25 4.25-4.25 4.25 4.25" />
                                        <path d="M4.5 16.5v1.75A1.75 1.75 0 0 0 6.25 20h11.5a1.75 1.75 0 0 0 1.75-1.75V16.5" />
                                    </svg>
                                    <p className="author-drop-title mt-3 text-sm">
                                        {mediaUploading
                                            ? t('author.form.imageUploading', 'Mengunggah media...')
                                            : isDraggingImage
                                                ? t('author.form.imageDropHere', 'Lepaskan gambar di sini')
                                                : t('author.form.imageDragUpload', 'Seret & lepas atau klik untuk unggah')}
                                    </p>
                                    <p className="author-drop-subtitle mt-1 text-xs">{t('author.form.imageHint', 'PNG, JPG, WEBP hingga 4MB')}</p>
                                </div>

                                {featuredImageLabel ? (
                                    <p className="author-image-ok mt-2 text-xs">{t('author.form.selectedFile', 'File dipilih: {name}', { name: featuredImageLabel })}</p>
                                ) : null}

                                {imageError ? (
                                    <p className="author-image-error mt-2 text-xs">{imageError}</p>
                                ) : null}

                                {featuredPreview ? (
                                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                        <img
                                            src={featuredPreview}
                                            alt={form.featured_image_alt || 'Gambar unggulan'}
                                            className="w-full h-36 object-cover rounded"
                                        />
                                        <div className="mt-2 flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={clearFeaturedImageSelection}
                                                disabled={mediaUploading}
                                                className="author-btn author-btn-secondary rounded-md px-3 py-2 text-xs font-semibold"
                                                title={t('author.form.removeFeaturedImage', 'Lepas gambar unggulan')}
                                            >
                                                {t('author.form.detachImage', 'Lepas')}
                                            </button>
                                            {selectedMediaId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => deleteMediaItem(selectedMediaId)}
                                                    disabled={mediaUploading}
                                                    className="author-btn author-btn-danger rounded-md px-3 py-2 text-xs font-semibold"
                                                    title={t('author.form.deleteFromLibrary', 'Hapus dari pustaka media')}
                                                >
                                                    {t('author.form.delete', 'Hapus')}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="mt-4">
                                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('author.form.mediaLibrary', 'Pustaka Media')}</p>
                                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {mediaLoading ? (
                                            <p className="text-xs text-slate-400 col-span-full">{t('common.loadingData', 'Memuat data...')}</p>
                                        ) : mediaItems.length ? (
                                            mediaItems.slice(0, 9).map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={`relative rounded border overflow-hidden text-left ${featuredImagePath === item.file_path ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            clearLocalImagePreview();
                                                            setFeaturedImagePath(item.file_path || '');
                                                            setFeaturedImageUrl(item.url || '');
                                                            setFeaturedImageLabel(item.file_name || item.file_path || '');
                                                            setSelectedMediaId(item?.id ? Number(item.id) : null);
                                                            if (!form.featured_image_alt && item.alt_text) {
                                                                setForm((previous) => ({
                                                                    ...previous,
                                                                    featured_image_alt: item.alt_text,
                                                                }));
                                                            }
                                                        }}
                                                        className="w-full text-left"
                                                        title={t('author.form.selectMedia', 'Pilih media')}
                                                    >
                                                        {String(item?.mime_type || '').startsWith('video/') ? (
                                                            <video src={mediaItemUrl(item)} className="w-full h-20 object-cover bg-black" muted controls />
                                                        ) : (
                                                            <img src={mediaItemUrl(item)} alt={item.alt_text || item.file_name} className="w-full h-20 object-cover" />
                                                        )}
                                                        <span className="block px-2 py-1 text-[10px] text-slate-600 truncate">{item.file_name}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            deleteMediaItem(item.id);
                                                        }}
                                                        className="absolute right-1 top-1 rounded bg-white/90 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                                                        title={t('author.form.deleteMedia', 'Hapus media')}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-slate-400 col-span-full">{t('author.form.mediaLibraryEmpty', 'Belum ada media tersimpan.')}</p>
                                        )}
                                    </div>
                                </div>
                            </article>

                            <article className="author-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div>
                                    <label className="author-form-label block">{t('table.category', 'Kategori')} *</label>
                                    <select
                                        name="category_id"
                                        value={isCategoryCreatorOpen ? ADD_CATEGORY_OPTION : form.category_id}
                                        onChange={handleCategorySelectChange}
                                        className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm"
                                        required
                                    >
                                        <option value="">{t('author.form.selectCategory', 'Pilih kategori')}</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>{t(`author.form.categoryOption.${category.id}`, category.name || '-')}</option>
                                        ))}
                                        <option value={ADD_CATEGORY_OPTION}>{t('author.form.addManualCategory', '+ Tambah kategori manual...')}</option>
                                    </select>

                                    {isCategoryCreatorOpen ? (
                                        <div className="author-category-creator mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <p className="author-category-creator-title text-xs font-semibold">{t('author.form.addNewCategory', 'Tambah Kategori Baru')}</p>

                                            <div className="mt-2 space-y-2">
                                                <input
                                                    type="text"
                                                    value={newCategoryName}
                                                    onChange={(event) => {
                                                        setCategoryError('');
                                                        setNewCategoryName(event.target.value);
                                                    }}
                                                    placeholder={t('author.form.categoryNamePlaceholder', 'Nama kategori')}
                                                    className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                                    maxLength={100}
                                                />

                                                <input
                                                    type="text"
                                                    value={newCategoryDescription}
                                                    onChange={(event) => setNewCategoryDescription(event.target.value)}
                                                    placeholder={t('author.form.categoryDescriptionPlaceholder', 'Deskripsi singkat (opsional)')}
                                                    className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                                    maxLength={255}
                                                />
                                            </div>

                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={createCategoryManual}
                                                    disabled={categorySaving}
                                                    className="author-btn author-btn-primary rounded-md px-3 py-2 text-xs font-semibold"
                                                >
                                                    {categorySaving ? t('common.saving', 'Menyimpan...') : t('author.form.saveCategory', 'Simpan Kategori')}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCategoryCreatorOpen(false);
                                                        setCategoryError('');
                                                        setNewCategoryName('');
                                                        setNewCategoryDescription('');
                                                    }}
                                                    className="author-btn author-btn-secondary rounded-md px-3 py-2 text-xs font-semibold"
                                                >
                                                    {t('common.cancel', 'Batal')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="mt-4">
                                    <label className="author-form-label block">{t('author.form.tagsLabel', 'Tags (Maksimal 5)')}</label>
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(event) => setTagInput(event.target.value)}
                                            onKeyDown={onTagInputKeyDown}
                                            placeholder={t('author.form.addTagPlaceholder', 'Tambah tag...')}
                                            className="author-form-input flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                            disabled={tags.length >= MAX_TAGS}
                                        />
                                        <button
                                            type="button"
                                            onClick={addTag}
                                            className="author-btn author-btn-dark rounded-md px-3 py-2 text-xs font-semibold"
                                            disabled={tags.length >= MAX_TAGS}
                                        >
                                            {t('common.add', 'Tambah')}
                                        </button>
                                    </div>

                                    {tags.length ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {tags.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => removeTag(tag)}
                                                    className="author-tag-chip rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]"
                                                    title={t('author.form.removeTag', 'Hapus tag')}
                                                >
                                                    {tag} ×
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </article>

                            <article className="author-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <label className="author-form-label block">{t('table.summary', 'Ringkasan')} *</label>
                                <textarea
                                    name="excerpt"
                                    value={form.excerpt}
                                    onChange={handleChange}
                                    onFocus={() => handleFocus('excerpt')}
                                    onBlur={() => handleBlur('excerpt')}
                                    rows={3}
                                    placeholder={t('author.form.summaryPlaceholder', 'Tulis ringkasan singkat artikel...')}
                                    className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                />
                                {isFieldFocused('excerpt') && <div className="rt-field-hint">{t('author.form.hintExcerpt', 'Minimal 120 karakter untuk SEO yang baik')}</div>}
                            </article>

                            <article className="author-form-card rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="author-form-label block mb-0">{t('table.content', 'Konten')} *</label>
                                    <div className="flex items-center gap-2">
                                        <button type="button" className="author-btn author-btn-secondary rounded-md px-2 py-1 text-xs font-semibold" onClick={() => addContentBlock(CONTENT_BLOCK_TYPES.TEXT)}>
                                            + Teks
                                        </button>
                                        <button type="button" className="author-btn author-btn-secondary rounded-md px-2 py-1 text-xs font-semibold" onClick={() => addContentBlock(CONTENT_BLOCK_TYPES.IMAGE)}>
                                            + Gambar
                                        </button>
                                        <button type="button" className="author-btn author-btn-secondary rounded-md px-2 py-1 text-xs font-semibold" onClick={() => addContentBlock(CONTENT_BLOCK_TYPES.VIDEO)}>
                                            + Video
                                        </button>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">Blok pertama adalah konten utama. Anda bisa drag-and-drop semua blok (teks/gambar/video) untuk ubah urutan.</p>
                                <div className="mt-3 space-y-2">
                                    {contentBlocks.length ? contentBlocks.map((block, index) => (
                                        <div
                                            key={block.id}
                                            draggable
                                            onDragStart={() => handleBlockDragStart(block.id)}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={() => handleBlockDrop(block.id)}
                                            onClick={() => {
                                                if (block.type === CONTENT_BLOCK_TYPES.TEXT) {
                                                    setActiveTextBlockId(block.id);
                                                }
                                            }}
                                            className="rounded-lg border border-slate-200 p-3 bg-slate-50"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-semibold text-slate-600">
                                                    #{index + 1} · {block.type.toUpperCase()} {index === 0 ? '· UTAMA' : ''}
                                                </p>
                                                <button type="button" className="author-btn author-btn-danger rounded-md px-2 py-1 text-xs font-semibold" onClick={() => removeContentBlock(block.id)}>
                                                    Hapus
                                                </button>
                                            </div>

                                            {block.type === CONTENT_BLOCK_TYPES.TEXT ? (
                                                <div className="mt-2">
                                                    {activeTextBlockId === block.id ? (
                                                        <div
                                                            className="author-rich-editor"
                                                            onFocus={() => handleFocus('content')}
                                                            onBlur={() => handleBlur('content')}
                                                        >
                                                            <RichToolbar
                                                                editor={editor}
                                                                visible={isFieldFocused('content')}
                                                                mode="rich"
                                                                onPromptLink={promptForLink}
                                                            />
                                                            <EditorContent editor={editor} />
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveTextBlockId(block.id)}
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                                                        >
                                                            Klik untuk edit teks terformat
                                                        </button>
                                                    )}
                                                </div>
                                            ) : null}

                                            {block.type === CONTENT_BLOCK_TYPES.IMAGE ? (
                                                <div className="mt-2 space-y-2">
                                                    <input
                                                        value={block.url}
                                                        onChange={(event) => updateContentBlock(block.id, { url: event.target.value })}
                                                        placeholder="URL gambar atau biarkan kosong jika unggah lokal"
                                                        className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                                    />
                                                    <input
                                                        value={block.alt_text}
                                                        onChange={(event) => updateContentBlock(block.id, { alt_text: event.target.value })}
                                                        placeholder="Alt text gambar"
                                                        className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                                    />
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        onChange={(event) => uploadBlockMedia(block, event.target.files?.[0])}
                                                        className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                                    />
                                                </div>
                                            ) : null}

                                            {block.type === CONTENT_BLOCK_TYPES.VIDEO ? (
                                                <div className="mt-2 space-y-2">
                                                    <input
                                                        value={block.url}
                                                        onChange={(event) => updateContentBlock(block.id, { url: event.target.value })}
                                                        placeholder="URL video atau unggah file mp4/webm"
                                                        className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                                                    />
                                                    <input
                                                        type="file"
                                                        accept="video/mp4,video/webm,video/quicktime"
                                                        onChange={(event) => uploadBlockMedia(block, event.target.files?.[0])}
                                                        className="author-form-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                    )) : (
                                        <p className="text-xs text-slate-400">Belum ada blok konten tambahan.</p>
                                    )}
                                </div>
                            </article>
                        </div>

                        <aside className="author-publish-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4">
                            <h3 className="author-publish-title text-sm font-semibold">{t('workflow.status.published', 'Publikasi')}</h3>
                            <p className="author-publish-subtitle mt-1 text-[11px]">{t('author.form.publishHint', 'Status akan dikirim ke alur editor sesuai tombol aksi.')}</p>

                            {isEdit ? (
                                <p className="mt-2 text-[11px] text-slate-500">{autosaveText}</p>
                            ) : null}

                            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('author.form.seoAssistant', 'Asisten SEO')}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-800">{t('author.form.seoScore', 'Skor SEO: {score}', { score: seoChecks.score })}</p>
                                <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                        className={`h-full ${seoChecks.score >= 80 ? 'bg-emerald-500' : seoChecks.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        style={{ width: `${seoChecks.score}%` }}
                                    />
                                </div>
                                <ul className="mt-2 space-y-1">
                                    {seoChecks.items.map((item) => (
                                        <li key={item.key} className={`text-[11px] ${item.passed ? 'text-emerald-700' : 'text-slate-500'}`}>
                                            {item.passed ? '✓' : '•'} {item.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {isEdit ? (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('author.form.versionHistory', 'Riwayat Versi')}</p>
                                    <div className="mt-2 max-h-40 overflow-auto space-y-1">
                                        {versionsLoading ? (
                                            <p className="text-xs text-slate-400">{t('common.loadingData', 'Memuat data...')}</p>
                                        ) : versions.length ? (
                                            versions.map((version) => (
                                                <div key={version.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                    <p className="text-[11px] font-semibold text-slate-700">{version.source || 'manual'}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDateTime(version.snapshot_at)}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-slate-400">{t('author.form.versionEmpty', 'Belum ada riwayat versi.')}</p>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => submitForm('pending')}
                                disabled={saving}
                                className="author-btn author-btn-primary mt-3 w-full rounded-md py-2.5 text-xs font-semibold"
                            >
                                {saving ? t('common.processing', 'Memproses...') : t('author.form.sendToReview', 'Kirim untuk Review')}
                            </button>

                            <button
                                type="button"
                                onClick={() => submitForm('draft')}
                                disabled={saving}
                                className="author-btn author-btn-secondary mt-2 w-full rounded-md py-2.5 text-xs font-semibold"
                            >
                                {t('author.form.saveDraft', 'Simpan Draft')}
                            </button>

                            <button
                                type="button"
                                onClick={openPreview}
                                className="author-btn author-btn-secondary mt-2 w-full rounded-md py-2.5 text-xs font-semibold"
                            >
                                {t('common.preview', 'Pratinjau')}
                            </button>

                            <button
                                type="button"
                                onClick={resetChanges}
                                className="author-btn author-btn-danger mt-3 w-full text-center text-[11px] font-semibold"
                            >
                                {t('author.form.discardChanges', 'Buang Perubahan')}
                            </button>
                        </aside>
                    </section>
                </div>
            )}
        </AuthorShell>
    );
}
