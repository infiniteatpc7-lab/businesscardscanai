<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class PlatformAdmin extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'platform_admins';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'last_login_at' => 'datetime',
        ];
    }

    /**
     * Active tokens belonging to this platform admin.
     */
    public function tokens(): HasMany
    {
        return $this->hasMany(PlatformAdminToken::class, 'platform_admin_id');
    }

    /**
     * Audit logs authored by this platform admin.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(PlatformAuditLog::class, 'platform_admin_id');
    }

    /**
     * Check if this administrator account is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Check if this administrator has super_admin privileges.
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }
}
