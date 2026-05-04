import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'blockquote',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'a',
    'span',
    'mark',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];
const COLOR_REGEX = /^(transparent|#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)|hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*(0|1|0?\.\d+)\s*\))$/i;
const FONT_FAMILIES = new Set([
    'calibri',
    'arial',
    'georgia',
    'times new roman',
    'courier new',
    'verdana',
    'tahoma',
    'trebuchet ms',
]);
const ALLOWED_STYLE_RULES = {
    'text-align': (value) => /^(left|right|center|justify)$/i.test(value),
    color: (value) => COLOR_REGEX.test(value),
    'background-color': (value) => COLOR_REGEX.test(value),
    'font-size': (value) => {
        const match = String(value).match(/^(\d{1,2})px$/);
        if (!match) return false;
        const size = Number(match[1]);
        return size >= 8 && size <= 72;
    },
    'font-family': (value) => {
        const families = String(value)
            .split(',')
            .map((part) => part.replace(/['"]/g, '').trim())
            .filter(Boolean);

        return families.some((family) => FONT_FAMILIES.has(family.toLowerCase()));
    },
};
let styleHookRegistered = false;

function ensureStyleHook() {
    if (styleHookRegistered) return;

    DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
        if (data.attrName === 'style') {
            const rawValue = String(data.attrValue || '');
            const sanitizedParts = rawValue
                .split(';')
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => {
                    const [prop, ...rest] = part.split(':');
                    const name = String(prop || '').trim().toLowerCase();
                    const value = rest.join(':').trim();
                    const rule = ALLOWED_STYLE_RULES[name];

                    if (!rule || !value) {
                        return null;
                    }

                    if (!rule(value)) {
                        return null;
                    }

                    if (name === 'font-family') {
                        const allowedFamilies = value
                            .split(',')
                            .map((family) => family.replace(/['"]/g, '').trim())
                            .filter((family) => FONT_FAMILIES.has(family.toLowerCase()))
                            .map((family) => (family.includes(' ') ? `"${family}"` : family));

                        if (!allowedFamilies.length) {
                            return null;
                        }

                        return `${name}: ${allowedFamilies.join(', ')}`;
                    }

                    return `${name}: ${value}`;
                })
                .filter(Boolean);

            if (!sanitizedParts.length) {
                data.keepAttr = false;
                return;
            }

            data.attrValue = sanitizedParts.join('; ');
        }
    });

    styleHookRegistered = true;
}

export function normalizeRichText(value) {
    const text = String(value || '');
    if (!text.trim()) return '';

    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);
    if (looksLikeHtml) {
        return text;
    }

    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const paragraphs = escaped
        .replace(/\r/g, '')
        .split(/\n{2,}/)
        .map((part) => part.replace(/\n/g, '<br/>').trim())
        .filter(Boolean);

    return paragraphs.length ? `<p>${paragraphs.join('</p><p>')}</p>` : '';
}

export function sanitizeHtml(value) {
    if (!value) return '';

    ensureStyleHook();

    return DOMPurify.sanitize(String(value), {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: true,
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'link', 'meta'],
        FORBID_ATTR: ['onerror', 'onclick', 'onload'],
    });
}

export function stripHtml(value) {
    if (!value) return '';

    const sanitized = sanitizeHtml(normalizeRichText(value));
    const container = document.createElement('div');
    container.innerHTML = sanitized;
    return container.textContent || container.innerText || '';
}
