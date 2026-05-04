<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AuthorAssignmentLogger
{
    public const ACTION_AUTO_BALANCE = 'auto_balance';
    public const ACTION_ASSIGN_ON_CREATE = 'assign_on_create';
    public const ACTION_MANUAL_MOVE = 'manual_move';
    public const ACTION_BULK_MOVE = 'bulk_move';
    public const ACTION_REASSIGN_INACTIVE = 'reassign_inactive';
    public const ACTION_UNASSIGN_ROLE_CHANGE = 'unassign_role_change';

    public static function log(
        int $authorId,
        ?int $fromReviewerId,
        ?int $toReviewerId,
        ?int $changedByUserId,
        string $action,
        ?string $note = null,
        array $metadata = [],
        $occurredAt = null
    ): void {
        if ($fromReviewerId === $toReviewerId) {
            return;
        }

        if (!Schema::hasTable('author_assignment_activities')) {
            // Keep assignment flows running even when activity migration has not been applied yet.
            return;
        }

        $trimmedNote = trim((string) ($note ?? ''));
        $happenedAt = $occurredAt ?? now();
        $now = now();

        DB::table('author_assignment_activities')->insert([
            'author_id' => $authorId,
            'from_reviewer_id' => $fromReviewerId,
            'to_reviewer_id' => $toReviewerId,
            'changed_by_user_id' => $changedByUserId,
            'action' => $action,
            'note' => $trimmedNote !== '' ? $trimmedNote : null,
            'metadata' => $metadata !== [] ? json_encode($metadata) : null,
            'occurred_at' => $happenedAt,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public static function actionLabel(string $action): string
    {
        return match ($action) {
            self::ACTION_AUTO_BALANCE => 'Auto load balancing',
            self::ACTION_ASSIGN_ON_CREATE => 'Assign saat create author',
            self::ACTION_MANUAL_MOVE => 'Pindah manual',
            self::ACTION_BULK_MOVE => 'Bulk move',
            self::ACTION_REASSIGN_INACTIVE => 'Reassign reviewer nonaktif',
            self::ACTION_UNASSIGN_ROLE_CHANGE => 'Unassign karena perubahan role',
            default => 'Perubahan assignment',
        };
    }
}
