<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CardScan extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'card_id',
        'exhibition_id',
        'user_id',
        'saved_by_user_id',
        'bulk_import_item_id',
        'scan_idempotency_key',
        'scanned_at',
        'front_image_path',
        'back_image_path',
        'accuracy_score',
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
            'scanned_at' => 'datetime',
            'accuracy_score' => 'integer',
        ];
    }

    /**
     * Get the workspace where the scan occurred.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Get the card associated with this scan.
     */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /**
     * Get the exhibition where this scan was captured.
     */
    public function exhibition(): BelongsTo
    {
        return $this->belongsTo(Exhibition::class);
    }

    /**
     * Get the staff user who performed the scan.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the user who confirmed/committed the save (if different from scanner).
     */
    public function savedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'saved_by_user_id');
    }

    /**
     * Get the staged bulk import item that generated this scan.
     */
    public function bulkImportItem(): BelongsTo
    {
        return $this->belongsTo(BulkImportItem::class);
    }

    /**
     * Get the AI API requests generated for this scan.
     */
    public function aiApiRequests(): HasMany
    {
        return $this->hasMany(AiApiRequest::class);
    }
}
