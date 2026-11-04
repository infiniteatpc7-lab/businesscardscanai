<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AiApiRequest extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'ai_api_requests';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'workspace_name',
        'user_id',
        'user_name',
        'user_email',
        'scan_type',
        'request_uuid',
        'idempotency_key',
        'card_scan_id',
        'card_id',
        'bulk_import_id',
        'bulk_import_item_id',
        'requested_model',
        'actual_model',
        'attempt_number',
        'is_fallback',
        'fallback_reason',
        'parent_request_id',
        'image_count',
        'status',
        'http_status',
        'error_code',
        'error_message',
        'started_at',
        'completed_at',
        'duration_ms',
        'prompt_tokens',
        'candidates_tokens',
        'thoughts_tokens',
        'cached_tokens',
        'total_tokens',
        'cost_usd',
        'cost_inr',
        'cost_calculation_status',
        'cost_calculated_at',
        'pricing_version',
        'exchange_rate',
        'model_pricing_id',
        'exchange_rate_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'is_fallback' => 'boolean',
            'image_count' => 'integer',
            'http_status' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'duration_ms' => 'integer',
            'prompt_tokens' => 'integer',
            'candidates_tokens' => 'integer',
            'thoughts_tokens' => 'integer',
            'cached_tokens' => 'integer',
            'total_tokens' => 'integer',
            'cost_usd' => 'decimal:6',
            'cost_inr' => 'decimal:6',
            'exchange_rate' => 'decimal:4',
            'cost_calculated_at' => 'datetime',
        ];
    }

    /**
     * Scope a query to only include successful AI API requests.
     */
    public function scopeSuccessful(Builder $query): Builder
    {
        return $query->where('status', 'success');
    }

    /**
     * Scope a query to only include failed AI API requests.
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope a query to only include single card scans.
     */
    public function scopeSingleScans(Builder $query): Builder
    {
        return $query->where('scan_type', 'single_scan');
    }

    /**
     * Scope a query to only include bulk batch imports.
     */
    public function scopeBulkScans(Builder $query): Builder
    {
        return $query->where('scan_type', 'bulk_scan');
    }

    /**
     * Scope a query by workspace ID.
     */
    public function scopeForWorkspace(Builder $query, int $workspaceId): Builder
    {
        return $query->where('workspace_id', $workspaceId);
    }

    /**
     * Scope a query to only include requests with finalized calculated costs.
     */
    public function scopeCostCalculated(Builder $query): Builder
    {
        return $query->where('cost_calculation_status', 'calculated');
    }

    /**
     * Scope a query to only include requests with pending or missing cost calculation.
     */
    public function scopeCostPending(Builder $query): Builder
    {
        return $query->whereIn('cost_calculation_status', ['pending', 'pricing_missing', 'exchange_rate_missing']);
    }

    /**
     * Estimated cost allocated per image for this request in USD.
     */
    public function costPerImageUsd(): ?float
    {
        if ($this->cost_usd === null) {
            return null;
        }

        $count = max(1, $this->image_count);

        return round(((float) $this->cost_usd) / $count, 6);
    }

    /**
     * Estimated cost allocated per image for this request in INR.
     */
    public function costPerImageInr(): ?float
    {
        if ($this->cost_inr === null) {
            return null;
        }

        $count = max(1, $this->image_count);

        return round(((float) $this->cost_inr) / $count, 6);
    }

    /**
     * Get the workspace attribution.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Get the user attribution.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the related card scan, if created.
     */
    public function cardScan(): BelongsTo
    {
        return $this->belongsTo(CardScan::class);
    }

    /**
     * Get the related card, if created.
     */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /**
     * Get the parent bulk import, if this was a bulk item scan.
     */
    public function bulkImport(): BelongsTo
    {
        return $this->belongsTo(BulkImport::class);
    }

    /**
     * Get the parent bulk import item, if this was a bulk item scan.
     */
    public function bulkImportItem(): BelongsTo
    {
        return $this->belongsTo(BulkImportItem::class);
    }

    /**
     * Get the model pricing version used to price this request.
     */
    public function modelPricing(): BelongsTo
    {
        return $this->belongsTo(AiModelPricing::class, 'model_pricing_id');
    }

    /**
     * Get the currency exchange rate used to convert cost to INR.
     */
    public function exchangeRate(): BelongsTo
    {
        return $this->belongsTo(AiCostExchangeRate::class, 'exchange_rate_id');
    }

    /**
     * Get the parent initial request if this was a retry/fallback attempt.
     */
    public function parentRequest(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_request_id');
    }

    /**
     * Get all fallback or retry attempts stemming from this request.
     */
    public function fallbackAttempts(): HasMany
    {
        return $this->hasMany(self::class, 'parent_request_id');
    }

    /**
     * Get the normalized usage details returned by Gemini.
     */
    public function usageDetail(): HasOne
    {
        return $this->hasOne(AiApiUsageDetail::class, 'ai_api_request_id');
    }
}
