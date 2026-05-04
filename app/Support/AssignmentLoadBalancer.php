<?php

namespace App\Support;

use App\Models\User;

class AssignmentLoadBalancer
{
    public static function leastLoadedActiveReviewerId(?int $excludeReviewerId = null): ?int
    {
        $query = User::query()
            ->where('role', 'reviewer')
            ->where('status', 'active')
            ->withCount([
                'assignedAuthors as active_assigned_authors_count' => function ($authorQuery) {
                    $authorQuery->where('status', 'active');
                },
            ])
            ->orderBy('active_assigned_authors_count')
            ->orderBy('id');

        if ($excludeReviewerId !== null) {
            $query->where('id', '!=', $excludeReviewerId);
        }

        $reviewer = $query->first(['id']);

        return $reviewer ? (int) $reviewer->id : null;
    }
}
