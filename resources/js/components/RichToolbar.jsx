import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MS Word / LibreOffice-style formatting toolbar that appears on focus.
 * Works with plain input/textarea fields (applies basic formatting via execCommand on a contentEditable)
 * AND with TipTap editor instances.
 * 
 * Props:
 *   - editor: TipTap editor instance (optional, for rich content fields)
 *   - mode: 'rich' | 'simple' — rich = TipTap, simple = basic text tools
 *   - visible: boolean — controlled visibility
 *   - className: extra classNames
 *   - fontFamilies: array of font family names
 *   - fontSizes: array of font size strings like '11px'
 *   - defaultFontFamily: string
 *   - defaultFontSize: string
 */

const FONT_FAMILIES = [
    'Calibri',
    'Arial',
    'Times New Roman',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Courier New',
    'Segoe UI',
    'Roboto',
];

const FONT_SIZES = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '72px'];
const DEFAULT_FONT_FAMILY = 'Calibri';
const DEFAULT_FONT_SIZE = '11px';

/* ───────── SVG Icon Components (MS Word style) ───────── */

function IconBold() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5h4.5a3 3 0 0 1 2.1 5.15A3.25 3.25 0 0 1 8.75 13.5H4a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5zm1 1v3.75h3.5a1.75 1.75 0 1 0 0-3.5H5v-.25zm0 5v3.75h3.75a2 2 0 1 0 0-3.75H5z" />
        </svg>
    );
}

function IconItalic() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.5 2.5h5l-.25 1H9.1L6.9 12.5h2.15l-.25 1h-5l.25-1h2.15L8.4 3.5H6.25l.25-1z" />
        </svg>
    );
}

function IconUnderline() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.5 2v6a3.5 3.5 0 1 0 7 0V2h1v6a4.5 4.5 0 0 1-9 0V2h1zM3.5 14h9v1h-9v-1z" />
        </svg>
    );
}

function IconStrikethrough() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 7.5h10v1H3v-1zM8 2.5c-1.66 0-3 .9-3 2.5 0 .53.2 1 .53 1.37l.97-.37C6.18 5.67 6 5.33 6 5c0-.83.9-1.5 2-1.5s2 .67 2 1.5h1c0-1.6-1.34-2.5-3-2.5zM6.5 10c0 .83.9 1.5 2 1.5s2-.67 2-1.5h1c0 1.6-1.34 2.5-3 2.5S5.5 11.6 5.5 10h1z" />
        </svg>
    );
}

function IconAlignLeft() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h12v1H2V3zm0 3h8v1H2V6zm0 3h12v1H2V9zm0 3h8v1H2v-1z" />
        </svg>
    );
}

function IconAlignCenter() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h12v1H2V3zm2 3h8v1H4V6zm-2 3h12v1H2V9zm2 3h8v1H4v-1z" />
        </svg>
    );
}

function IconAlignRight() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h12v1H2V3zm4 3h8v1H6V6zm-4 3h12v1H2V9zm4 3h8v1H6v-1z" />
        </svg>
    );
}

function IconAlignJustify() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h12v1H2V3zm0 3h12v1H2V6zm0 3h12v1H2V9zm0 3h12v1H2v-1z" />
        </svg>
    );
}

function IconBulletList() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="4" r="1.2" />
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="3" cy="12" r="1.2" />
            <rect x="6" y="3.2" width="8" height="1.4" rx=".4" />
            <rect x="6" y="7.2" width="8" height="1.4" rx=".4" />
            <rect x="6" y="11.2" width="8" height="1.4" rx=".4" />
        </svg>
    );
}

function IconOrderedList() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <text x="1.5" y="5" fontSize="5" fontWeight="700" fontFamily="Arial">1.</text>
            <text x="1.5" y="9" fontSize="5" fontWeight="700" fontFamily="Arial">2.</text>
            <text x="1.5" y="13" fontSize="5" fontWeight="700" fontFamily="Arial">3.</text>
            <rect x="6" y="3.2" width="8" height="1.4" rx=".4" />
            <rect x="6" y="7.2" width="8" height="1.4" rx=".4" />
            <rect x="6" y="11.2" width="8" height="1.4" rx=".4" />
        </svg>
    );
}

function IconBlockquote() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3v10h1V3H3zm3 1v2.5h2.5V8.5L6 11h1.5l2.5-3V4H6zm5 0v2.5H13.5V8.5L11 11h1.5l2.5-3V4h-4z" />
        </svg>
    );
}

function IconLink() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 9.5l3-3M7 11.5l-1.7 1.7a2 2 0 0 1-2.8-2.8L4.2 8.7M9 4.5l1.7-1.7a2 2 0 0 1 2.8 2.8l-1.7 1.7" />
        </svg>
    );
}

function IconUnlink() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 11.5l-1.7 1.7a2 2 0 0 1-2.8-2.8L4.2 8.7M9 4.5l1.7-1.7a2 2 0 0 1 2.8 2.8l-1.7 1.7M2 14L14 2" />
        </svg>
    );
}

function IconUndo() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.35 5.65l-2.85-2v4.7h4.7l-2.05-2.05A4.5 4.5 0 1 1 3.5 10.5h-1A5.5 5.5 0 1 0 4.35 5.65z" />
        </svg>
    );
}

function IconRedo() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ transform: 'scaleX(-1)' }}>
            <path d="M4.35 5.65l-2.85-2v4.7h4.7l-2.05-2.05A4.5 4.5 0 1 1 3.5 10.5h-1A5.5 5.5 0 1 0 4.35 5.65z" />
        </svg>
    );
}

function IconClearFormat() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3h7.5l-.7 1H6.35L4.5 12.5h-1.2L5.15 4H3L2 3zm4.5 7.5L12.5 4.5l.7.7-6 6-.7-.7zM10 12.5h4v1h-4v-1z" />
        </svg>
    );
}

function IconHighlight() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10.6 2.3l3.1 3.1-7.4 7.4-3.1-3.1 7.4-7.4zM2.5 13.5h5v1h-5v-1z" />
        </svg>
    );
}

function IconTextColor() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.67 10H3.8L7.3 2h1.4l3.5 8h-1.87l-.83-2H6.5l-.83 2zM8 3.75L6.9 6.5h2.2L8 3.75z" />
            <rect x="3" y="12" width="10" height="2" rx=".5" fill="currentColor" opacity=".6" />
        </svg>
    );
}

function IconParagraph() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 2h7v1h-2v11h-1V3H8v11H7V8.5A3.5 3.5 0 0 1 3.5 5 3.5 3.5 0 0 1 6 2z" />
        </svg>
    );
}

function IconH1() {
    return (
        <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
            <text x="0" y="13" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">H1</text>
        </svg>
    );
}

function IconH2() {
    return (
        <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
            <text x="0" y="13" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">H2</text>
        </svg>
    );
}

function IconH3() {
    return (
        <svg width="20" height="16" viewBox="0 0 20 16" fill="currentColor">
            <text x="0" y="13" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif">H3</text>
        </svg>
    );
}


/* ────────── ToolButton ────────── */
function ToolButton({ onClick, active, disabled, title, children, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`rt-btn ${active ? 'rt-btn-active' : ''} ${className}`}
        >
            {children}
        </button>
    );
}

/* ────────── Divider ────────── */
function Divider() {
    return <span className="rt-divider" />;
}

/* ────────── Color Picker Button ────────── */
function ColorButton({ value, onChange, title, icon, disabled }) {
    const inputRef = useRef(null);
    return (
        <button
            type="button"
            className="rt-btn rt-color-btn"
            title={title}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
        >
            {icon}
            <span className="rt-color-swatch" style={{ backgroundColor: value }} />
            <input
                ref={inputRef}
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rt-color-input"
                tabIndex={-1}
            />
        </button>
    );
}

/* ═══════════════════════════════════════════
   Main RichToolbar Component
   ═══════════════════════════════════════════ */

export default function RichToolbar({
    editor,
    visible = true,
    mode = 'rich',
    fontFamilies = FONT_FAMILIES,
    fontSizes = FONT_SIZES,
    defaultFontFamily = DEFAULT_FONT_FAMILY,
    defaultFontSize = DEFAULT_FONT_SIZE,
    onPromptLink,
    className = '',
}) {
    if (!visible) return null;

    const isRich = mode === 'rich' && editor;

    /* ── Active states for TipTap ── */
    const textStyle = isRich ? (editor.getAttributes('textStyle') || {}) : {};
    const activeFont = textStyle.fontFamily || defaultFontFamily;
    const activeSize = textStyle.fontSize || defaultFontSize;
    const activeColor = /^#/.test(textStyle.color || '') ? textStyle.color : '#0f172a';
    const activeHighlight = /^#/.test(editor?.getAttributes('highlight')?.color || '')
        ? editor.getAttributes('highlight').color
        : '#fde68a';

    /* ── Font handlers ── */
    function handleFontFamily(value) {
        if (!isRich) return;
        editor.chain().focus().setFontFamily(value || defaultFontFamily).run();
    }
    function handleFontSize(value) {
        if (!isRich) return;
        editor.commands.setFontSize(value || defaultFontSize);
    }
    function handleTextColor(value) {
        if (!isRich) return;
        editor.chain().focus().setColor(value).run();
    }
    function handleHighlightColor(value) {
        if (!isRich) return;
        editor.chain().focus().setHighlight({ color: value }).run();
    }

    return (
        <div className={`rt-toolbar ${visible ? 'rt-toolbar-visible' : ''} ${className}`}>
            {/* ─── Row 1: Font Family, Size, Colors ─── */}
            <div className="rt-row">
                {isRich && (
                    <>
                        <div className="rt-group">
                            <select
                                className="rt-select rt-font-select"
                                value={activeFont}
                                onChange={(e) => handleFontFamily(e.target.value)}
                                disabled={!editor}
                                title="Font Family"
                            >
                                {fontFamilies.map((f) => (
                                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                                ))}
                            </select>

                            <select
                                className="rt-select rt-size-select"
                                value={activeSize}
                                onChange={(e) => handleFontSize(e.target.value)}
                                disabled={!editor}
                                title="Font Size"
                            >
                                {fontSizes.map((s) => (
                                    <option key={s} value={s}>{s.replace('px', '')}</option>
                                ))}
                            </select>
                        </div>

                        <Divider />
                    </>
                )}

                {/* ─── Text Formatting ─── */}
                {isRich && (
                    <>
                        <div className="rt-group">
                            <ToolButton
                                onClick={() => editor.chain().focus().toggleBold().run()}
                                active={editor.isActive('bold')}
                                disabled={!editor}
                                title="Bold (Ctrl+B)"
                            >
                                <IconBold />
                            </ToolButton>

                            <ToolButton
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                                active={editor.isActive('italic')}
                                disabled={!editor}
                                title="Italic (Ctrl+I)"
                            >
                                <IconItalic />
                            </ToolButton>

                            <ToolButton
                                onClick={() => editor.chain().focus().toggleUnderline().run()}
                                active={editor.isActive('underline')}
                                disabled={!editor}
                                title="Underline (Ctrl+U)"
                            >
                                <IconUnderline />
                            </ToolButton>

                            <ToolButton
                                onClick={() => editor.chain().focus().toggleStrike().run()}
                                active={editor.isActive('strike')}
                                disabled={!editor}
                                title="Strikethrough"
                            >
                                <IconStrikethrough />
                            </ToolButton>
                        </div>

                        <Divider />

                        {/* ─── Colors ─── */}
                        <div className="rt-group">
                            <ColorButton
                                value={activeColor}
                                onChange={handleTextColor}
                                title="Text Color"
                                icon={<IconTextColor />}
                                disabled={!editor}
                            />
                            <ToolButton
                                onClick={() => editor.chain().focus().unsetColor().run()}
                                disabled={!editor}
                                title="Reset Text Color"
                                className="rt-btn-tiny"
                            >
                                ✕
                            </ToolButton>

                            <ColorButton
                                value={activeHighlight}
                                onChange={handleHighlightColor}
                                title="Highlight Color"
                                icon={<IconHighlight />}
                                disabled={!editor}
                            />
                            <ToolButton
                                onClick={() => editor.chain().focus().unsetHighlight().run()}
                                disabled={!editor}
                                title="Remove Highlight"
                                className="rt-btn-tiny"
                            >
                                ✕
                            </ToolButton>
                        </div>
                    </>
                )}
            </div>

            {/* ─── Row 2: Paragraph, Headings, Lists, Alignment, Links, Undo/Redo ─── */}
            {isRich && (
                <div className="rt-row">
                    {/* Paragraph / Headings */}
                    <div className="rt-group">
                        <ToolButton
                            onClick={() => editor.chain().focus().setParagraph().run()}
                            active={editor.isActive('paragraph')}
                            disabled={!editor}
                            title="Normal Text"
                        >
                            <IconParagraph />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                            active={editor.isActive('heading', { level: 1 })}
                            disabled={!editor}
                            title="Heading 1"
                        >
                            <IconH1 />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            active={editor.isActive('heading', { level: 2 })}
                            disabled={!editor}
                            title="Heading 2"
                        >
                            <IconH2 />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                            active={editor.isActive('heading', { level: 3 })}
                            disabled={!editor}
                            title="Heading 3"
                        >
                            <IconH3 />
                        </ToolButton>
                    </div>

                    <Divider />

                    {/* Lists & Blockquote */}
                    <div className="rt-group">
                        <ToolButton
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            active={editor.isActive('bulletList')}
                            disabled={!editor}
                            title="Bullet List"
                        >
                            <IconBulletList />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            active={editor.isActive('orderedList')}
                            disabled={!editor}
                            title="Numbered List"
                        >
                            <IconOrderedList />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                            active={editor.isActive('blockquote')}
                            disabled={!editor}
                            title="Blockquote"
                        >
                            <IconBlockquote />
                        </ToolButton>
                    </div>

                    <Divider />

                    {/* Text Alignment */}
                    <div className="rt-group">
                        <ToolButton
                            onClick={() => editor.chain().focus().setTextAlign('left').run()}
                            active={editor.isActive({ textAlign: 'left' })}
                            disabled={!editor}
                            title="Align Left"
                        >
                            <IconAlignLeft />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().setTextAlign('center').run()}
                            active={editor.isActive({ textAlign: 'center' })}
                            disabled={!editor}
                            title="Align Center"
                        >
                            <IconAlignCenter />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().setTextAlign('right').run()}
                            active={editor.isActive({ textAlign: 'right' })}
                            disabled={!editor}
                            title="Align Right"
                        >
                            <IconAlignRight />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                            active={editor.isActive({ textAlign: 'justify' })}
                            disabled={!editor}
                            title="Justify"
                        >
                            <IconAlignJustify />
                        </ToolButton>
                    </div>

                    <Divider />

                    {/* Links */}
                    <div className="rt-group">
                        <ToolButton
                            onClick={onPromptLink || (() => {})}
                            active={editor.isActive('link')}
                            disabled={!editor}
                            title="Insert Link"
                        >
                            <IconLink />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().unsetLink().run()}
                            disabled={!editor}
                            title="Remove Link"
                        >
                            <IconUnlink />
                        </ToolButton>
                    </div>

                    <Divider />

                    {/* Clear / Undo / Redo */}
                    <div className="rt-group">
                        <ToolButton
                            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                            disabled={!editor}
                            title="Clear Formatting"
                        >
                            <IconClearFormat />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={!editor || !editor.can().undo()}
                            title="Undo (Ctrl+Z)"
                        >
                            <IconUndo />
                        </ToolButton>
                        <ToolButton
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={!editor || !editor.can().redo()}
                            title="Redo (Ctrl+Y)"
                        >
                            <IconRedo />
                        </ToolButton>
                    </div>
                </div>
            )}
        </div>
    );
}


/* ═══════════════════════════════════════════
   useFieldFocus hook — show toolbar on focus
   ═══════════════════════════════════════════ */
export function useFieldFocus() {
    const [focusedField, setFocusedField] = useState(null);
    const timerRef = useRef(null);

    const handleFocus = useCallback((fieldName) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setFocusedField(fieldName);
    }, []);

    const handleBlur = useCallback((fieldName) => {
        // Delay blur to allow clicking toolbar buttons
        timerRef.current = setTimeout(() => {
            setFocusedField((prev) => (prev === fieldName ? null : prev));
        }, 250);
    }, []);

    const isFieldFocused = useCallback(
        (fieldName) => focusedField === fieldName,
        [focusedField]
    );

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return { focusedField, handleFocus, handleBlur, isFieldFocused };
}
