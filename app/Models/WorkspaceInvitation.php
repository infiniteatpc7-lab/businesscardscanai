<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class WorkspaceInvitation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'inviter_id',
        'email',
        'role',
        'token',
        'expires_at',
        'accepted_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    /**
     * Workspace being invited to.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * User who created the invitation.
     */
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inviter_id');
    }

    /**
     * Check if the invitation is valid for acceptance.
     */
    public function isValid(): bool
    {
        if ($this->accepted_at !== null) {
            return false;
        }

        if ($this->expires_at && Carbon::now()->greaterThan($this->expires_at)) {
            return false;
        }

        return true;
    }

    /**
     * Check if the invitation has expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at && Carbon::now()->greaterThan($this->expires_at);
    }

    /**
     * Mark the invitation as accepted.
     */
    public function markAccepted(): void
    {
        $this->update([
            'accepted_at' => Carbon::now(),
        ]);
    }

    /**
     * Create a new invitation storing only a SHA-256 hashed token and returning the plaintext token.
     *
     * @return array{invitation: self, plainToken: string}
     */
    public static function createInvitation(
        Workspace $workspace,
        User $inviter,
        string $email,
        string $role = 'member',
        int $expiryDays = 7
    ): array {
        $plainToken = Str::random(40);
        $hashedToken = hash('sha256', $plainToken);

        // Invalidate any prior pending invitation for this email in this workspace
        static::where('workspace_id', $workspace->id)
            ->where('email', strtolower(trim($email)))
            ->whereNull('accepted_at')
            ->delete();

        $invitation = static::create([
            'workspace_id' => $workspace->id,
            'inviter_id' => $inviter->id,
            'email' => strtolower(trim($email)),
            'role' => $role,
            'token' => $hashedToken,
            'expires_at' => Carbon::now()->addDays($expiryDays),
        ]);

        return [
            'invitation' => $invitation,
            'plainToken' => $plainToken,
        ];
    }

    /**
     * Find an invitation by plaintext token (checks SHA-256 hash).
     */
    public static function findByPlainToken(string $plainToken): ?self
    {
        $hashedToken = hash('sha256', trim($plainToken));

        return static::where('token', $hashedToken)->first();
    }
}
