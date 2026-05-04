<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->unsignedSmallInteger('priority_score')->default(50)->after('status');
            $table->timestamp('review_due_at')->nullable()->after('priority_score');
            $table->string('featured_image_alt')->nullable()->after('featured_image');
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['priority_score', 'review_due_at', 'featured_image_alt']);
        });
    }
};
