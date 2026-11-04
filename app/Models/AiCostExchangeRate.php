<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class AiCostExchangeRate extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'ai_cost_exchange_rates';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'base_currency',
        'target_currency',
        'exchange_rate',
        'effective_date',
        'source',
        'is_active',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'exchange_rate' => 'decimal:4',
            'effective_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Scope a query to only include active exchange rates.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to locate the most relevant rate for a currency pair as of a specific date.
     */
    public function scopeForDate(Builder $query, CarbonInterface|string|null $date = null, string $base = 'USD', string $target = 'INR'): Builder
    {
        $dateStr = $date ? Carbon::parse($date)->toDateString() : now()->toDateString();

        return $query->where('base_currency', $base)
            ->where('target_currency', $target)
            ->where('is_active', true)
            ->where('effective_date', '<=', $dateStr)
            ->orderByDesc('effective_date');
    }

    /**
     * Scope a query to locate the most relevant rate for a currency pair.
     */
    public function scopeLatestFor(Builder $query, string $base = 'USD', string $target = 'INR'): Builder
    {
        return $query->where('base_currency', $base)
            ->where('target_currency', $target)
            ->where('is_active', true)
            ->latest('effective_date');
    }

    /**
     * Get the AI API requests that used this exchange rate for cost calculation.
     */
    public function apiRequests(): HasMany
    {
        return $this->hasMany(AiApiRequest::class, 'exchange_rate_id');
    }
}
