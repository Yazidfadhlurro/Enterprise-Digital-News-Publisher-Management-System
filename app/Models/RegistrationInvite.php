<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class RegistrationInvite extends Model
{
    use HasFactory;

    protected $fillable = [
        'email',
        'role',
        'token',
        'status',
        'expires_at',
        'used_at',
        'revoked_at',
        'invited_by_user_id',
        'used_by_user_id',
        'note',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_user_id');
    }

    public function usedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'used_by_user_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at instanceof Carbon && $this->expires_at->isPast();
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null || $this->status === 'used';
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null || $this->status === 'revoked';
    }

    public function isActive(): bool
    {
        return !$this->isUsed() && !$this->isRevoked() && !$this->isExpired();
    }
}