<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PlatformAdminToken extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'platform_admin_tokens';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'platform_admin_id',
        'name',
        'token',
        'last_used_at',
        'expires_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * The platform admin who owns this token.
     */
    public function platformAdmin(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'platform_admin_id');
    }

    /**
     * Issue a cryptographically secure token for the specified platform administrator.
     *
     * @return array{token: string, model: PlatformAdminToken}
     */
    public static function createTokenForAdmin(
        PlatformAdmin $admin,
        string $name = 'admin_session',
        ?\DateTimeInterface $expiresAt = null
    ): array {
        $plainToken = 'bcs_adm_'.Str::random(48);
        $hashedToken = hash('sha256', $plainToken);

        if ($expiresAt === null) {
            // Default admin session duration: 24 hours
            $expiresAt = now()->addHours(24);
        }

        $tokenModel = static::create([
            'platform_admin_id' => $admin->id,
            'name' => $name,
            'token' => $hashedToken,
            'expires_at' => $expiresAt,
        ]);

        return [
            'token' => $plainToken,
            'model' => $tokenModel,
        ];
    }

    /**
     * Find a token record by raw plain text token.
     */
    public static function findToken(string $plainToken): ?static
    {
        if (empty($plainToken)) {
            return null;
        }

        $hashedToken = hash('sha256', $plainToken);

        return static::where('token', $hashedToken)
            ->with('platformAdmin')
            ->first();
    }

    /**
     * Check if this token is expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
