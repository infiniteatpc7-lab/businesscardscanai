<?php

namespace App\Models;

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
    ];

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
     * Get all business cards stored in this workspace.
     */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
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
     * Check if user is a member of the workspace.
     */
    public function hasUser(User|int $user): bool
    {
        $userId = $user instanceof User ? $user->id : $user;

        return $this->users()->where('user_id', $userId)->exists();
    }
}
