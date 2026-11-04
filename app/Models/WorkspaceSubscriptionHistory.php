<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class WorkspaceSubscriptionHistory extends Model
{
    use HasFactory;

    /**
     * Immutable append-only history log: updated_at is disabled.
     */
    public const UPDATED_AT = null;

    protected $table = 'workspace_subscription_histories';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'subscription_id',
        'previous_plan_id',
        'plan_id',
        'previous_status',
        'status',
        'assignment_source',
        'period_starts_at',
        'period_ends_at',
        'assigned_by_admin_id',
        'reason',
        'idempotency_key',
        'metadata',
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
            'period_starts_at' => 'datetime',
            'period_ends_at' => 'datetime',
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Boot model events for consistency validation.
     */
    protected static function booted(): void
    {
        static::creating(function (WorkspaceSubscriptionHistory $history) {
            if ($history->subscription_id && $history->workspace_id) {
                $sub = WorkspaceSubscription::find($history->subscription_id);
                if ($sub && (int) $sub->workspace_id !== (int) $history->workspace_id) {
                    throw new InvalidArgumentException('Subscription does not belong to the specified workspace.');
                }
            }
        });
    }

    /**
     * Workspace owning this subscription history.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Active or historical subscription record referenced.
     */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(WorkspaceSubscription::class, 'subscription_id');
    }

    /**
     * Previous Plan before this transition, if applicable.
     */
    public function previousPlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'previous_plan_id');
    }

    /**
     * New or assigned Plan for this transition.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    /**
     * Platform Admin who performed the assignment, if applicable.
     */
    public function assignedByAdmin(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'assigned_by_admin_id');
    }
}
