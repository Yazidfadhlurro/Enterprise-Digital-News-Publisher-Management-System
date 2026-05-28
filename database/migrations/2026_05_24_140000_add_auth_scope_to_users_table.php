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
            $table->string('auth_scope', 20)->default('public')->after('role');
            $table->index('auth_scope');
        });

        DB::table('users')
            ->whereIn('role', ['admin', 'reviewer', 'author'])
            ->update(['auth_scope' => 'internal']);

        DB::table('users')
            ->where('role', 'user')
            ->update(['auth_scope' => 'public']);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['auth_scope']);
            $table->dropColumn('auth_scope');
        });
    }
};
