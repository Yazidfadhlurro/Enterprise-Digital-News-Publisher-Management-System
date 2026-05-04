<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained()->onDelete('cascade');
            $table->foreignId('reader_id')->constrained()->onDelete('cascade');
            $table->unsignedTinyInteger('rating');
            $table->timestamps();

            $table->unique(['article_id', 'reader_id']);
            $table->index(['article_id', 'rating']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_ratings');
    }
};
