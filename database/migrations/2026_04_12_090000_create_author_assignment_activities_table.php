<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('author_assignment_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('from_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('changed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 64);
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();

            $table->index(['action', 'occurred_at']);
            $table->index(['author_id', 'occurred_at']);
            $table->index(['to_reviewer_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('author_assignment_activities');
    }
};
