<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class InternalUsersSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $accounts = [
            [
                'name' => 'Admin User',
                'email' => 'admin@portal.com',
                'role' => 'admin',
                'assigned_reviewer_id' => null,
            ],
            [
                'name' => 'Editor User',
                'email' => 'editor@portal.com',
                'role' => 'reviewer',
                'assigned_reviewer_id' => null,
            ],
            [
                'name' => 'Author User',
                'email' => 'author@portal.com',
                'role' => 'author',
                'assigned_reviewer_id' => null, // diisi setelah reviewer dibuat
            ],
        ];

        foreach ($accounts as $account) {
            DB::table('users')->updateOrInsert(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => Hash::make('password'),
                    'role' => $account['role'],
                    'auth_scope' => 'internal',
                    'status' => 'active',
                    'email_verified_at' => $now,
                    'email_verification_code' => null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }

        // assign reviewer ke author
        $reviewerId = DB::table('users')->where('email', 'editor@portal.com')->value('id');
        if ($reviewerId) {
            DB::table('users')->where('email', 'author@portal.com')
                ->update(['assigned_reviewer_id' => $reviewerId]);
        }
    }
}
