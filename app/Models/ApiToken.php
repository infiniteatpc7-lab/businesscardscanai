<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ApiToken extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
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
     * Get the user that owns the token.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Generate a new secure API token for the given user.
     * Returns an array with ['token' => $plainTextToken, 'model' => $apiToken].
     */
    public static function createTokenForUser(User $user, string $name = 'default', ?\DateTimeInterface $expiresAt = null): array
    {
        $plainToken = 'bcs_'.Str::random(40);
        $hashedToken = hash('sha256', $plainToken);

        $model = static::create([
            'user_id' => $user->id,
            'name' => $name,
            'token' => $hashedToken,
            'expires_at' => $expiresAt,
        ]);

        return [
            'plain_token' => $plainToken,
            'token_model' => $model,
        ];
    }

    /**
     * Find a valid token model matching the given plain-text token.
     */
    public static function findToken(string $plainToken): ?self
    {
        $hashedToken = hash('sha256', $plainToken);

        $tokenModel = static::with('user')->where('token', $hashedToken)->first();

        if (! $tokenModel) {
            return null;
        }

        if ($tokenModel->expires_at && $tokenModel->expires_at->isPast()) {
            return null;
        }

        $tokenModel->forceFill(['last_used_at' => now()])->save();

        return $tokenModel;
    }
}
