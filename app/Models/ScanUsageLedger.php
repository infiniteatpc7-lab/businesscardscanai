<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScanUsageLedger extends Model
{
    use HasFactory;

    protected $table = 'scan_usage_ledger';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'subscription_id',
        'user_id',
        'card_id',
        'card_scan_id',
        'bulk_import_item_id',
        'idempotency_key',
        'operation_type',
        'quantity',
        'status',
        'reserved_at',
        'confirmed_at',
        'released_at',
        'billing_period_starts_at',
        'billing_period_ends_at',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'reserved_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'released_at' => 'datetime',
            'billing_period_starts_at' => 'datetime',
            'billing_period_ends_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(WorkspaceSubscription::class, 'subscription_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    public function cardScan(): BelongsTo
    {
        return $this->belongsTo(CardScan::class);
    }

    public function bulkImportItem(): BelongsTo
    {
        return $this->belongsTo(BulkImportItem::class);
    }

    public function isReserved(): bool
    {
        return $this->status === 'reserved';
    }

    public function isConfirmed(): bool
    {
        return $this->status === 'confirmed';
    }

    public function isReleased(): bool
    {
        return $this->status === 'released';
    }
}
