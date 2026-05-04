<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class EditorialActivityLogger
{
    public const STAGES = ['draft', 'review', 'revision', 'published'];

    public static function normalizeStage(?string $status): ?string
    {
        if ($status === null) {
            return null;
        }

        $value = strtolower(trim($status));

        return match ($value) {
            'draft' => 'draft',
            'pending', 'approved' => 'review',
            'revision', 'rejected' => 'revision',
            'published' => 'published',
            default => null,
        };
    }

    public static function stageLabel(string $stage): string
    {
        return match ($stage) {
            'draft' => 'Draft',
            'review' => 'Review',
            'revision' => 'Revisi',
            'published' => 'Publikasi',
            default => 'Workflow',
        };
    }

    public static function defaultActorName(string $stage): string
    {
        return in_array($stage, ['revision', 'published'], true)
            ? 'Reviewer'
            : 'Penulis';
    }

    public static function buildMessage(string $stage, string $actorName, string $title): string
    {
        return match ($stage) {
            'draft' => sprintf('%s menyimpan draft berita "%s"', $actorName, $title),
            'review' => sprintf('%s mengirim berita ke tahap review "%s"', $actorName, $title),
            'revision' => sprintf('%s mengembalikan berita ke revisi "%s"', $actorName, $title),
            'published' => sprintf('%s mempublikasikan berita "%s"', $actorName, $title),
            default => sprintf('%s memperbarui berita "%s"', $actorName, $title),
        };
    }

    public static function logTransition(
        int $articleId,
        ?string $fromStatus,
        ?string $toStatus,
        ?int $actorId = null,
        ?string $actorRole = null,
        ?string $note = null,
        $occurredAt = null
    ): void {
        $toStage = self::normalizeStage($toStatus);
        if (!$toStage) {
            return;
        }

        $fromStage = self::normalizeStage($fromStatus);

        // Simpan hanya event perpindahan tahap workflow, termasuk event pertama saat artikel dibuat.
        if ($fromStage !== null && $fromStage === $toStage) {
            return;
        }

        $happenedAt = $occurredAt ?? now();
        $trimmedNote = trim((string) ($note ?? ''));
        $now = now();

        DB::table('editorial_activities')->insert([
            'article_id' => $articleId,
            'actor_id' => $actorId,
            'actor_role' => $actorRole,
            'from_status' => $fromStatus,
            'to_status' => (string) $toStatus,
            'from_stage' => $fromStage,
            'to_stage' => $toStage,
            'note' => $trimmedNote !== '' ? $trimmedNote : null,
            'occurred_at' => $happenedAt,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
