<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
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
        'description',
        'price',
        'currency',
        'monthly_scan_allowance',
        'invoice_interval',
        'is_active',
        'is_default',
        'features',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'monthly_scan_allowance' => 'integer',
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'features' => 'array',
        ];
    }

    /**
     * Subscriptions attached to this plan.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(WorkspaceSubscription::class);
    }

    /**
     * Scope for active plans.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Resolve the default Free Plan for new workspaces.
     */
    public static function getDefaultPlan(): ?self
    {
        return self::where('is_default', true)->where('is_active', true)->first()
            ?? self::where('slug', 'free')->first()
            ?? self::first();
    }

    /**
     * Check if the plan is active.
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Check if the plan is free.
     */
    public function isFree(): bool
    {
        return (float) $this->price === 0.0 || $this->slug === 'free';
    }
}
