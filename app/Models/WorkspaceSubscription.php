<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkspaceSubscription extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'plan_id',
        'status',
        'started_at',
        'current_period_starts_at',
        'current_period_ends_at',
        'cancelled_at',
        'assignment_source',
        'gateway_name',
        'gateway_subscription_id',
        'gateway_customer_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'current_period_starts_at' => 'datetime',
            'current_period_ends_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * Workspace owning this subscription.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Plan assigned to this subscription.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * Usage ledger entries for this subscription.
     */
    public function usageLedger(): HasMany
    {
        return $this->hasMany(ScanUsageLedger::class, 'subscription_id');
    }

    /**
     * Determine if subscription is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Ensure current billing period is up-to-date and roll forward if the period expired.
     */
    public function ensureCurrentPeriod(): self
    {
        $now = now();
        if ($this->current_period_ends_at && $now->greaterThanOrEqualTo($this->current_period_ends_at)) {
            $diffMonths = $this->current_period_ends_at->diffInMonths($now) + 1;
            $newStart = $this->current_period_ends_at->copy();
            $newEnd = $newStart->copy()->addMonths($diffMonths);

            $this->update([
                'current_period_starts_at' => $newStart,
                'current_period_ends_at' => $newEnd,
            ]);
        }

        return $this;
    }
}
