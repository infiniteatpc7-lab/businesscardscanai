<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'current_workspace_id', 'status', 'suspended_at', 'suspension_reason', 'suspended_by_admin_id'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'suspended_at' => 'datetime',
        ];
    }

    /**
     * Get all workspaces the user belongs to.
     */
    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_user')
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * Get workspaces owned by this user.
     */
    public function ownedWorkspaces(): HasMany
    {
        return $this->hasMany(Workspace::class, 'owner_id');
    }

    /**
     * Get API tokens issued to this user.
     */
    public function apiTokens(): HasMany
    {
        return $this->hasMany(ApiToken::class);
    }

    /**
     * Get the exhibitions selected by this user across workspaces.
     */
    public function selectedExhibitions(): HasMany
    {
        return $this->hasMany(UserSelectedExhibition::class);
    }

    /**
     * Get all card scans performed by this user.
     */
    public function cardScans(): HasMany
    {
        return $this->hasMany(CardScan::class);
    }

    /**
     * Create a new secure API token for this user.
     */
    public function createToken(string $name = 'default', ?\DateTimeInterface $expiresAt = null): array
    {
        return ApiToken::createTokenForUser($this, $name, $expiresAt);
    }

    /**
     * Get the user's current or selected workspace.
     * Respects persisted current_workspace_id.
     */
    public function currentWorkspace(?int $workspaceId = null): ?Workspace
    {
        if ($workspaceId) {
            return $this->workspaces()->where('workspaces.id', $workspaceId)->first();
        }

        if ($this->current_workspace_id) {
            $workspace = $this->workspaces()->where('workspaces.id', $this->current_workspace_id)->first();
            if ($workspace) {
                return $workspace;
            }
        }

        $first = $this->workspaces()->first();
        if ($first && ! $this->current_workspace_id) {
            $this->forceFill(['current_workspace_id' => $first->id])->saveQuietly();
        }

        return $first;
    }

    /**
     * Switch and persist current workspace after validating membership.
     */
    public function switchWorkspace(int|Workspace $workspace): bool
    {
        $workspaceId = $workspace instanceof Workspace ? $workspace->id : $workspace;

        if (! $this->workspaces()->where('workspaces.id', $workspaceId)->exists()) {
            return false;
        }

        $this->forceFill(['current_workspace_id' => $workspaceId])->save();

        return true;
    }

    /**
     * Check if user has a role in a workspace.
     */
    public function hasWorkspaceRole(Workspace $workspace, string|array $roles): bool
    {
        $role = $workspace->getUserRole($this);
        if (! $role) {
            return false;
        }

        $roles = (array) $roles;

        return in_array($role, $roles, true);
    }

    /**
     * Invitations sent by this user.
     */
    public function sentInvitations(): HasMany
    {
        return $this->hasMany(WorkspaceInvitation::class, 'inviter_id');
    }

    /**
     * Get all AI API requests triggered by this user.
     */
    public function aiApiRequests(): HasMany
    {
        return $this->hasMany(AiApiRequest::class);
    }

    /**
     * Platform administrator who suspended this customer.
     */
    public function suspendedByAdmin(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'suspended_by_admin_id');
    }

    /**
     * Determine if customer account is suspended.
     */
    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    /**
     * Determine if customer account is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
