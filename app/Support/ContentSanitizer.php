<?php

namespace App\Support;

use HTMLPurifier;
use HTMLPurifier_Config;

class ContentSanitizer
{
    private static ?HTMLPurifier $purifier = null;

    public static function sanitizeRichText(?string $value): string
    {
        $raw = (string) ($value ?? '');
        if (trim($raw) == '') {
            return '';
        }

        return self::purifier()->purify($raw);
    }

    public static function sanitizePlainText(?string $value): string
    {
        $raw = strip_tags((string) ($value ?? ''));
        $normalized = preg_replace("/\r\n?/", "\n", $raw) ?? $raw;
        return trim($normalized);
    }

    /**
     * Escape SQL LIKE wildcard characters (%, _) from user input.
     *
     * This prevents LIKE wildcard injection attacks where a user could
     * submit '%' or '_' to match unintended data patterns.
     */
    public static function escapeLikeWildcards(?string $value, string $escapeChar = '!'): string
    {
        $raw = (string) ($value ?? '');

        $escapeChar = $escapeChar !== '' ? mb_substr($escapeChar, 0, 1) : '!';

        return str_replace(
            [$escapeChar, '%', '_'],
            [$escapeChar.$escapeChar, $escapeChar.'%', $escapeChar.'_'],
            $raw
        );
    }

    public static function sanitizeMediaPath(?string $value): ?string
    {
        $path = trim((string) ($value ?? ''));
        if ($path == '') {
            return null;
        }

        if (str_contains($path, '..')) {
            return null;
        }

        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }

        $normalized = ltrim($path, '/');

        if (str_starts_with($normalized, 'storage/')) {
            return $normalized;
        }

        if (preg_match('#^[A-Za-z0-9/_\.\-]+$#', $normalized)) {
            return $normalized;
        }

        return null;
    }

    private static function purifier(): HTMLPurifier
    {
        if (self::$purifier) {
            return self::$purifier;
        }

        $config = HTMLPurifier_Config::createDefault();
        $config->set('Cache.DefinitionImpl', null);
        $config->set('HTML.DefinitionID', 'portal-berita-rich-text');
        $config->set('HTML.DefinitionRev', 1);
        $config->set('HTML.Allowed', implode(',', [
            'p[style|class]',
            'br',
            'strong',
            'b',
            'em',
            'i',
            'u',
            's',
            'blockquote[style|class]',
            'ul[style|class]',
            'ol[style|class]',
            'li[style|class]',
            'h1[style|class]',
            'h2[style|class]',
            'h3[style|class]',
            'h4[style|class]',
            'h5[style|class]',
            'h6[style|class]',
            'a[href|target|rel]',
            'img[src|alt|title|class]',
            'video[src|controls|preload|poster|class]',
            'source[src|type]',
            'span[style|class]',
            'mark[style|class]',
        ]));
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('URI.AllowedSchemes', [
            'http' => true,
            'https' => true,
            'mailto' => true,
            'tel' => true,
        ]);
        $config->set('HTML.Nofollow', true);
        $config->set('HTML.TargetBlank', true);
        $config->set('HTML.TargetNoopener', true);
        $config->set('HTML.TargetNoreferrer', true);
        $config->set('Attr.AllowedRel', [
            'nofollow' => true,
            'noopener' => true,
            'noreferrer' => true,
        ]);
        $config->set('CSS.AllowedProperties', [
            'text-align',
            'color',
            'background-color',
            'font-size',
            'font-family',
        ]);
        $config->set('AutoFormat.RemoveEmpty', true);

        if ($definition = $config->maybeGetRawHTMLDefinition()) {
            $definition->addElement('mark', 'Inline', 'Inline', 'Common');
            $definition->addElement('video', 'Block', 'Optional: #PCDATA | Flow | source', 'Common', [
                'src' => 'URI',
                'controls' => 'Bool',
                'preload' => 'Text',
                'poster' => 'URI',
            ]);
            $definition->addElement('source', 'Block', 'Empty', 'Common', [
                'src' => 'URI',
                'type' => 'Text',
            ]);
        }

        self::$purifier = new HTMLPurifier($config);

        return self::$purifier;
    }
}
