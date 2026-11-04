<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class AiModelPricing extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'ai_model_pricing';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'provider',
        'model_identifier',
        'pricing_version',
        'input_token_price_per_million',
        'output_token_price_per_million',
        'cached_input_token_price_per_million',
        'thoughts_token_price_per_million',
        'input_token_unit_price',
        'output_token_unit_price',
        'cached_input_token_unit_price',
        'thoughts_token_unit_price',
        'currency',
        'effective_from',
        'effective_to',
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
            'input_token_price_per_million' => 'decimal:6',
            'output_token_price_per_million' => 'decimal:6',
            'cached_input_token_price_per_million' => 'decimal:6',
            'thoughts_token_price_per_million' => 'decimal:6',
            'input_token_unit_price' => 'decimal:10',
            'output_token_unit_price' => 'decimal:10',
            'cached_input_token_unit_price' => 'decimal:10',
            'thoughts_token_unit_price' => 'decimal:10',
            'effective_from' => 'datetime',
            'effective_to' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Scope a query to only include active model pricing.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to find the active pricing for a specific model identifier as of a given timestamp.
     */
    public function scopeForModel(Builder $query, string $model, CarbonInterface|string|null $asOf = null): Builder
    {
        $time = $asOf ? Carbon::parse($asOf) : now();

        return $query->where('model_identifier', $model)
            ->where('is_active', true)
            ->where('effective_from', '<=', $time)
            ->where(function (Builder $q) use ($time) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>', $time);
            })
            ->latest('effective_from');
    }

    /**
     * Calculate cost in USD for given token usage based on this pricing version.
     */
    public function calculateCostUsd(
        int $promptTokens,
        int $candidatesTokens,
        int $cachedTokens = 0,
        int $thoughtsTokens = 0
    ): float {
        $promptCost = $promptTokens * (float) $this->input_token_unit_price;
        $candidatesCost = $candidatesTokens * (float) $this->output_token_unit_price;
        $cachedCost = $cachedTokens * (float) $this->cached_input_token_unit_price;
        $thoughtsCost = $thoughtsTokens * (float) $this->thoughts_token_unit_price;

        return round($promptCost + $candidatesCost + $cachedCost + $thoughtsCost, 6);
    }

    /**
     * Get the AI API requests that used this pricing version.
     */
    public function apiRequests(): HasMany
    {
        return $this->hasMany(AiApiRequest::class, 'model_pricing_id');
    }
}
