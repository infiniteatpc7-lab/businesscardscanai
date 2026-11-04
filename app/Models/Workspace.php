<?php

namespace App\Models;

use App\Services\WorkspaceSubscriptionService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workspace extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'owner_id',
        'status',
        'suspended_at',
        'suspension_reason',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'suspended_at' => 'datetime',
        ];
    }

    /**
     * Determine if workspace is suspended.
     */
    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    /**
     * Determine if workspace is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Get the owner of the workspace.
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Get all users that belong to this workspace.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_user')
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * Boot model events for Workspace.
     */
    protected static function booted(): void
    {
        static::created(function (Workspace $workspace) {
            app(WorkspaceSubscriptionService::class)->assignInitialFreePlan($workspace);
        });
    }

    /**
     * Get all subscriptions for this workspace.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(WorkspaceSubscription::class);
    }

    /**
     * Get all immutable subscription history records for this workspace.
     */
    public function subscriptionHistories(): HasMany
    {
        return $this->hasMany(WorkspaceSubscriptionHistory::class)->latest('id');
    }

    /**
     * Get all payment transactions for this workspace.
     */
    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class)->latest('id');
    }

    /**
     * Get the active subscription for this workspace, auto-assigning Free Plan if missing.
     */
    public function activeSubscription(): WorkspaceSubscription
    {
        $subscription = $this->subscriptions()
            ->with('plan')
            ->where('status', 'active')
            ->latest('id')
            ->first();

        if (! $subscription) {
            $subscription = app(WorkspaceSubscriptionService::class)->assignInitialFreePlan($this);
        }

        $subscription->ensureCurrentPeriod();

        return $subscription;
    }

    /**
     * Get the currently assigned Plan for this workspace.
     */
    public function currentPlan(): Plan
    {
        return $this->activeSubscription()->plan;
    }

    /**
     * Check if current workspace plan includes a specific feature key.
     */
    public function hasFeature(string $featureKey): bool
    {
        return $this->currentPlan()->hasFeature($featureKey);
    }

    /**
     * Check if the workspace can invite more team members according to plan limit.
     */
    public function canInviteMoreMembers(): bool
    {
        $plan = $this->currentPlan();
        if ($plan->isUnlimited('max_team_members')) {
            return true;
        }

        $limit = $plan->max_team_members ?? 1;
        $activeMembers = $this->users()->count();
        $pendingInvites = $this->invitations()->whereNull('accepted_at')->count();

        return ($activeMembers + $pendingInvites) < $limit;
    }

    /**
     * Check if the workspace can create more active exhibitions according to plan limit.
     */
    public function canCreateMoreExhibitions(): bool
    {
        $plan = $this->currentPlan();
        if ($plan->isUnlimited('max_active_exhibitions')) {
            return true;
        }

        $limit = $plan->max_active_exhibitions ?? 1;
        $activeCount = $this->exhibitions()->whereIn('status', ['active', 'upcoming'])->count();

        return $activeCount < $limit;
    }

    /**
     * Get all scan usage ledger entries for this workspace.
     */
    public function scanUsageLedger(): HasMany
    {
        return $this->hasMany(ScanUsageLedger::class);
    }

    /**
     * Get all business cards stored in this workspace.
     */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    /**
     * Get all exhibitions belonging to this workspace.
     */
    public function exhibitions(): HasMany
    {
        return $this->hasMany(Exhibition::class);
    }

    /**
     * Get all card scans performed in this workspace.
     */
    public function cardScans(): HasMany
    {
        return $this->hasMany(CardScan::class);
    }

    /**
     * Get the role of a specific user in this workspace.
     */
    public function getUserRole(User|int $user): ?string
    {
        $userId = $user instanceof User ? $user->id : $user;

        $pivot = $this->users()->where('user_id', $userId)->first()?->pivot;

        return $pivot?->role;
    }

    /**
     * Check if user is the workspace owner.
     */
    public function isOwner(User|int $user): bool
    {
        $userId = $user instanceof User ? $user->id : $user;

        return $this->owner_id === $userId || $this->getUserRole($userId) === 'owner';
    }

    /**
     * Check if user has admin privileges (either owner or admin role).
     */
    public function isAdmin(User|int $user): bool
    {
        $role = $this->getUserRole($user);

        return in_array($role, ['owner', 'admin'], true);
    }

    /**
     * Get all invitations for this workspace.
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(WorkspaceInvitation::class);
    }

    /**
     * Check if a user is the sole owner of this workspace.
     */
    public function isSoleOwner(User|int $user): bool
    {
        $userId = $user instanceof User ? $user->id : $user;

        if (! $this->isOwner($userId)) {
            return false;
        }

        // Count how many users have owner role in pivot or are owner_id
        $ownerCount = $this->users()
            ->wherePivot('role', 'owner')
            ->count();

        // If owner_id is set and not already in pivot as owner, ensure count accounts for it
        if ($this->owner_id && ! $this->users()->wherePivot('role', 'owner')->where('users.id', $this->owner_id)->exists()) {
            $ownerCount++;
        }

        return $ownerCount <= 1;
    }

    /**
     * Determine if an actor role can invite a target role.
     */
    public static function canInviteRole(string $actorRole, string $targetRole): bool
    {
        if ($actorRole === 'owner') {
            return in_array($targetRole, ['admin', 'member'], true);
        }

        if ($actorRole === 'admin') {
            return $targetRole === 'member';
        }

        return false;
    }

    /**
     * Determine if an actor role can manage (change role or remove) a target role.
     */
    public static function canManageRole(string $actorRole, string $targetRole): bool
    {
        if ($actorRole === 'owner') {
            return in_array($targetRole, ['owner', 'admin', 'member'], true);
        }

        if ($actorRole === 'admin') {
            return $targetRole === 'member';
        }

        return false;
    }

    /**
     * Determine if an actor role can view team members and pending invitations.
     */
    public static function canViewTeam(string $actorRole): bool
    {
        return in_array($actorRole, ['owner', 'admin'], true);
    }

    /**
     * Determine if an actor role can manage workspace settings.
     */
    public static function canManageSettings(string $actorRole): bool
    {
        return in_array($actorRole, ['owner', 'admin'], true);
    }

    /**
     * Check if user is a member of the workspace.
     */
    public function hasUser(User|int $user): bool
    {
        $userId = $user instanceof User ? $user->id : $user;

        return $this->users()->where('user_id', $userId)->exists();
    }
}
