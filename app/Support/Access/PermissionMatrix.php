<?php

namespace App\Support\Access;

use Illuminate\Support\Facades\DB;

class PermissionMatrix
{
    private const ROLES = ['admin', 'reviewer', 'author', 'user'];

    private const ACTIONS = [
        'admin.dashboard.view' => ['category' => 'Admin', 'label' => 'Lihat Dashboard Admin'],
        'admin.articles.view' => ['category' => 'Admin', 'label' => 'Lihat Artikel Admin'],
        'admin.articles.create' => ['category' => 'Admin', 'label' => 'Buat Artikel Admin'],
        'admin.articles.update' => ['category' => 'Admin', 'label' => 'Edit Artikel Admin'],
        'admin.articles.delete' => ['category' => 'Admin', 'label' => 'Hapus Artikel Admin'],
        'admin.categories.view' => ['category' => 'Admin', 'label' => 'Lihat Kategori Admin'],
        'admin.categories.create' => ['category' => 'Admin', 'label' => 'Buat Kategori Admin'],
        'admin.categories.update' => ['category' => 'Admin', 'label' => 'Edit Kategori Admin'],
        'admin.categories.delete' => ['category' => 'Admin', 'label' => 'Hapus Kategori Admin'],
        'admin.users.view' => ['category' => 'Admin', 'label' => 'Lihat User'],
        'admin.users.create' => ['category' => 'Admin', 'label' => 'Buat User'],
        'admin.users.update' => ['category' => 'Admin', 'label' => 'Edit User'],
        'admin.users.delete' => ['category' => 'Admin', 'label' => 'Hapus User'],
        'admin.users.status' => ['category' => 'Admin', 'label' => 'Ubah Status User'],
        'admin.assignments.view' => ['category' => 'Admin', 'label' => 'Lihat Manajemen Penugasan'],
        'admin.assignments.update' => ['category' => 'Admin', 'label' => 'Ubah Manajemen Penugasan'],
        'admin.activities.view' => ['category' => 'Admin', 'label' => 'Lihat Aktivitas Admin'],
        'admin.activities.export' => ['category' => 'Admin', 'label' => 'Export Aktivitas CSV'],
        'admin.permissions.view' => ['category' => 'Admin', 'label' => 'Lihat Permission Matrix'],
        'admin.permissions.update' => ['category' => 'Admin', 'label' => 'Ubah Permission Matrix'],
        'reviewer.dashboard.view' => ['category' => 'Editor', 'label' => 'Lihat Dashboard Editor'],
        'reviewer.review.queue.view' => ['category' => 'Editor', 'label' => 'Lihat Queue Review'],
        'reviewer.review.detail.view' => ['category' => 'Editor', 'label' => 'Lihat Detail Review'],
        'reviewer.review.approve' => ['category' => 'Editor', 'label' => 'Approve Artikel'],
        'reviewer.review.reject' => ['category' => 'Editor', 'label' => 'Reject Artikel'],
        'reviewer.activities.view' => ['category' => 'Editor', 'label' => 'Lihat Aktivitas Editor'],
        'author.dashboard.view' => ['category' => 'Author', 'label' => 'Lihat Dashboard Penulis'],
        'author.articles.view' => ['category' => 'Author', 'label' => 'Lihat Artikel Penulis'],
        'author.articles.create' => ['category' => 'Author', 'label' => 'Buat Artikel Penulis'],
        'author.articles.update' => ['category' => 'Author', 'label' => 'Edit Artikel Penulis'],
        'author.articles.delete' => ['category' => 'Author', 'label' => 'Hapus Artikel Penulis'],
        'author.articles.submit_review' => ['category' => 'Author', 'label' => 'Kirim ke Review'],
        'author.articles.autosave' => ['category' => 'Author', 'label' => 'Autosave Artikel'],
        'author.articles.versions.view' => ['category' => 'Author', 'label' => 'Lihat Riwayat Versi'],
        'author.media.view' => ['category' => 'Author', 'label' => 'Lihat Media Library'],
        'author.media.upload' => ['category' => 'Author', 'label' => 'Upload Media'],
        'author.activities.view' => ['category' => 'Author', 'label' => 'Lihat Aktivitas Penulis'],
    ];

    private const DEFAULTS = [
        'admin' => [
            'admin.dashboard.view',
            'admin.articles.view',
            'admin.articles.create',
            'admin.articles.update',
            'admin.articles.delete',
            'admin.categories.view',
            'admin.categories.create',
            'admin.categories.update',
            'admin.categories.delete',
            'admin.users.view',
            'admin.users.create',
            'admin.users.update',
            'admin.users.delete',
            'admin.users.status',
            'admin.assignments.view',
            'admin.assignments.update',
            'admin.activities.view',
            'admin.activities.export',
            'admin.permissions.view',
            'admin.permissions.update',
            'reviewer.dashboard.view',
            'reviewer.review.queue.view',
            'reviewer.review.detail.view',
            'reviewer.review.approve',
            'reviewer.review.reject',
            'reviewer.activities.view',
            'author.dashboard.view',
            'author.articles.view',
            'author.articles.create',
            'author.articles.update',
            'author.articles.delete',
            'author.articles.submit_review',
            'author.articles.autosave',
            'author.articles.versions.view',
            'author.media.view',
            'author.media.upload',
            'author.activities.view',
        ],
        'reviewer' => [
            'reviewer.dashboard.view',
            'reviewer.review.queue.view',
            'reviewer.review.detail.view',
            'reviewer.review.approve',
            'reviewer.review.reject',
            'reviewer.activities.view',
        ],
        'author' => [
            'author.dashboard.view',
            'author.articles.view',
            'author.articles.create',
            'author.articles.update',
            'author.articles.delete',
            'author.articles.submit_review',
            'author.articles.autosave',
            'author.articles.versions.view',
            'author.media.view',
            'author.media.upload',
            'author.activities.view',
        ],
        'user' => [],
    ];

    public static function roles(): array
    {
        return self::ROLES;
    }

    public static function actions(): array
    {
        return collect(self::ACTIONS)
            ->map(function (array $meta, string $key) {
                return [
                    'key' => $key,
                    'category' => $meta['category'],
                    'label' => $meta['label'],
                ];
            })
            ->values()
            ->all();
    }

    public static function isAllowed(string $role, string $actionKey): bool
    {
        $normalizedRole = self::normalizeRole($role);
        $normalizedAction = self::normalizeAction($actionKey);

        if ($normalizedAction === '' || !array_key_exists($normalizedAction, self::ACTIONS)) {
            return false;
        }

        $override = DB::table('role_action_permissions')
            ->where('role', $normalizedRole)
            ->where('action_key', $normalizedAction)
            ->value('is_allowed');

        if ($override !== null) {
            return (bool) $override;
        }

        return in_array($normalizedAction, self::DEFAULTS[$normalizedRole] ?? [], true);
    }

    public static function matrix(): array
    {
        $overrides = DB::table('role_action_permissions')
            ->select('role', 'action_key', 'is_allowed')
            ->get()
            ->groupBy('role');

        $result = [];

        foreach (self::ROLES as $role) {
            $result[$role] = [];

            foreach (array_keys(self::ACTIONS) as $actionKey) {
                $result[$role][$actionKey] = in_array($actionKey, self::DEFAULTS[$role] ?? [], true);
            }

            foreach (($overrides[$role] ?? []) as $row) {
                $result[$role][$row->action_key] = (bool) $row->is_allowed;
            }
        }

        return $result;
    }

    public static function upsertMany(array $entries, ?int $updatedBy = null): void
    {
        $rows = [];
        $now = now();

        foreach ($entries as $entry) {
            $role = self::normalizeRole((string) ($entry['role'] ?? ''));
            $actionKey = self::normalizeAction((string) ($entry['action_key'] ?? ''));

            if (!in_array($role, self::ROLES, true)) {
                continue;
            }

            if (!array_key_exists($actionKey, self::ACTIONS)) {
                continue;
            }

            $rows[] = [
                'role' => $role,
                'action_key' => $actionKey,
                'is_allowed' => (bool) ($entry['is_allowed'] ?? false),
                'updated_by' => $updatedBy,
                'updated_at' => $now,
                'created_at' => $now,
            ];
        }

        if ($rows === []) {
            return;
        }

        DB::table('role_action_permissions')->upsert(
            $rows,
            ['role', 'action_key'],
            ['is_allowed', 'updated_by', 'updated_at']
        );
    }

    private static function normalizeRole(string $role): string
    {
        return strtolower(trim($role));
    }

    private static function normalizeAction(string $action): string
    {
        return strtolower(trim($action));
    }
}
