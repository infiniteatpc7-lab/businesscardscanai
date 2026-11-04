<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulkImportItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'bulk_import_id',
        'workspace_id',
        'user_id',
        'client_item_id',
        'sequence_order',
        'status',
        'front_image_path',
        'back_image_path',
        'extracted_data',
        'accuracy_score',
        'error_message',
        'matched_card_id',
        'match_reason',
        'decision',
        'saved_card_id',
        'saved_scan_id',
        'saved_at',
    ];

    protected function casts(): array
    {
        return [
            'extracted_data' => 'array',
            'sequence_order' => 'integer',
            'accuracy_score' => 'integer',
            'saved_at' => 'datetime',
        ];
    }

    public function bulkImport(): BelongsTo
    {
        return $this->belongsTo(BulkImport::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function matchedCard(): BelongsTo
    {
        return $this->belongsTo(Card::class, 'matched_card_id');
    }

    public function savedCard(): BelongsTo
    {
        return $this->belongsTo(Card::class, 'saved_card_id');
    }

    public function savedScan(): BelongsTo
    {
        return $this->belongsTo(CardScan::class, 'saved_scan_id');
    }

    public function aiApiRequests(): HasMany
    {
        return $this->hasMany(AiApiRequest::class);
    }

    public function scopeForWorkspace(Builder $query, int $workspaceId): Builder
    {
        return $query->where('workspace_id', $workspaceId);
    }
}
