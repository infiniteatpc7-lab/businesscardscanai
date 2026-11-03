<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;

class PlatformAuditLog extends Model
{
    use HasFactory;

    /**
     * Disable updated_at since audit logs are immutable append-only records.
     */
    public const UPDATED_AT = null;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'platform_audit_logs';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'platform_admin_id',
        'action',
        'target_type',
        'target_id',
        'details',
        'ip_address',
        'user_agent',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'details' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * The administrator who performed the action.
     */
    public function platformAdmin(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'platform_admin_id');
    }

    /**
     * Helper to write a structured audit log entry.
     */
    public static function record(
        ?PlatformAdmin $admin,
        string $action,
        ?Model $target = null,
        ?array $details = null,
        ?Request $request = null
    ): static {
        $ip = $request ? $request->ip() : request()->ip();
        $ua = $request ? $request->userAgent() : request()->userAgent();

        return static::create([
            'platform_admin_id' => $admin?->id,
            'action' => $action,
            'target_type' => $target ? get_class($target) : null,
            'target_id' => $target?->getKey(),
            'details' => $details,
            'ip_address' => $ip,
            'user_agent' => $ua ? substr($ua, 0, 500) : null,
            'created_at' => now(),
        ]);
    }
}
