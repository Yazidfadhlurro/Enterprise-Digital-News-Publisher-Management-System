<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('articles')->onDelete('cascade');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source', 40)->default('manual');
            $table->string('title');
            $table->string('slug');
            $table->text('excerpt')->nullable();
            $table->longText('content');
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('featured_image')->nullable();
            $table->string('featured_image_alt')->nullable();
            $table->timestamp('snapshot_at');
            $table->timestamps();

            $table->index(['article_id', 'snapshot_at']);
            $table->index(['author_id', 'snapshot_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_versions');
    }
};
