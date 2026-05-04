<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('assigned_reviewer_id')
                ->nullable()
                ->after('role')
                ->constrained('users')
                ->nullOnDelete();
        });

        $fallbackReviewerId = DB::table('users')
            ->where('role', 'reviewer')
            ->where('status', 'active')
            ->orderBy('id')
            ->value('id');

        if ($fallbackReviewerId) {
            DB::table('users')
                ->where('role', 'author')
                ->whereNull('assigned_reviewer_id')
                ->update([
                    'assigned_reviewer_id' => $fallbackReviewerId,
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_reviewer_id');
        });
    }
};
