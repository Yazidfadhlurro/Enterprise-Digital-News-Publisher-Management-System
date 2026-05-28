<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // ====================================
    // Properties
    // ====================================

    protected $fillable = [
        'name',
        'email',
        'phone',
        'address',
        'bio',
        'password',
        'role',
        'auth_scope',
        'assigned_reviewer_id',
        'avatar',
        'status',
        'email_verification_code',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'email_verification_code',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    // ====================================
    // Role Methods
    // ====================================

    public function hasRole($role): bool
    {
        return $this->role === $role;
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isReviewer(): bool
    {
        return $this->hasRole('reviewer');
    }

    public function isAuthor(): bool
    {
        return $this->hasRole('author');
    }

    public function isUser(): bool
    {
        return $this->hasRole('user');
    }

    public function authScope(): string
    {
        if (!blank($this->auth_scope)) {
            return (string) $this->auth_scope;
        }

        return $this->isUser() ? 'public' : 'internal';
    }

    public function isPublicUser(): bool
    {
        return $this->authScope() === 'public';
    }

    public function isInternalUser(): bool
    {
        return $this->authScope() === 'internal';
    }

    // ====================================
    // Status Methods
    // ====================================

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isInactive(): bool
    {
        return $this->status === 'inactive';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    // ====================================
    // Email Verification Methods
    // ====================================

    public function isEmailVerified(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function needsEmailVerification(): bool
    {
        return $this->role !== 'admin' && !$this->isEmailVerified();
    }

    public function generateVerificationCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    // ====================================
    // Permission Methods
    // ====================================

    public function canCreateArticles(): bool
    {
        return in_array($this->role, ['admin', 'author']) && $this->isActive();
    }

    public function canReviewArticles(): bool
    {
        return in_array($this->role, ['admin', 'reviewer']) && $this->isActive();
    }

    public function canManageUsers(): bool
    {
        return $this->isAdmin() && $this->isActive();
    }

    public function canEditArticle($articleId = null): bool
    {
        if (!$this->canCreateArticles()) {
            return false;
        }

        if ($this->isAdmin()) {
            return true;
        }

        return $articleId ? $this->hasArticle($articleId) : true;
    }

    public function canDeleteArticle($articleId = null): bool
    {
        return $this->canEditArticle($articleId);
    }

    public function assignedReviewer()
    {
        return $this->belongsTo(self::class, 'assigned_reviewer_id');
    }

    public function assignedAuthors()
    {
        return $this->hasMany(self::class, 'assigned_reviewer_id');
    }

    // ====================================
    // Utility Methods
    // ====================================

    public function hasArticle($articleId): bool
    {
        return \Illuminate\Support\Facades\DB::table('articles')
            ->where('id', $articleId)
            ->where('author_id', $this->id)
            ->exists();
    }
}
