<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_action_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('role', 32);
            $table->string('action_key', 120);
            $table->boolean('is_allowed')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['role', 'action_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_action_permissions');
    }
};
