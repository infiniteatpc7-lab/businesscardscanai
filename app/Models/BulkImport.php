<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class BulkImport extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'user_id',
        'committed_by_user_id',
        'exhibition_id',
        'batch_uuid',
        'status',
        'total_items',
        'uploaded_items',
        'processed_items',
        'failed_items',
        'saved_items',
        'skipped_items',
        'max_batch_size',
        'cancelled_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'cancelled_at' => 'datetime',
            'expires_at' => 'datetime',
            'total_items' => 'integer',
            'uploaded_items' => 'integer',
            'processed_items' => 'integer',
            'failed_items' => 'integer',
            'saved_items' => 'integer',
            'skipped_items' => 'integer',
            'max_batch_size' => 'integer',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function committedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'committed_by_user_id');
    }

    public function exhibition(): BelongsTo
    {
        return $this->belongsTo(Exhibition::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BulkImportItem::class)->orderBy('sequence_order');
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null || $this->status === 'cancelled';
    }

    /**
     * Database-agnostic authoritative counter recalculation compatible with SQLite, MySQL, and PostgreSQL.
     */
    public function recalculateCounters(): void
    {
        $statusCounts = DB::table('bulk_import_items')
            ->where('bulk_import_id', $this->id)
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $pending = (int) ($statusCounts['pending'] ?? 0);
        $extracting = (int) ($statusCounts['extracting'] ?? 0);
        $extracted = (int) ($statusCounts['extracted'] ?? 0);
        $duplicateDetected = (int) ($statusCounts['duplicate_detected'] ?? 0);
        $saving = (int) ($statusCounts['saving'] ?? 0);
        $saved = (int) ($statusCounts['saved'] ?? 0);
        $failed = (int) ($statusCounts['failed'] ?? 0);
        $skipped = (int) ($statusCounts['skipped'] ?? 0);
        $total = array_sum($statusCounts);

        $processed = $extracted + $duplicateDetected;

        $newStatus = $this->status;
        if (! in_array($this->status, ['draft', 'cancelled'], true)) {
            if ($saved > 0 && ($saved + $skipped) === $total) {
                $newStatus = 'completed';
            } elseif ($saved > 0 || $saving > 0) {
                $newStatus = 'partially_saved';
            } elseif (($processed + $failed + $skipped) === $total && $total > 0 && $extracting === 0 && $pending === 0) {
                $newStatus = 'ready_for_review';
            } elseif ($extracting > 0 || $pending > 0) {
                $newStatus = 'processing';
            }
        }

        $this->update([
            'total_items' => $total,
            'uploaded_items' => $total,
            'processed_items' => $processed,
            'failed_items' => $failed,
            'saved_items' => $saved,
            'skipped_items' => $skipped,
            'status' => $newStatus,
        ]);
    }

    public function scopeForWorkspace(Builder $query, int $workspaceId): Builder
    {
        return $query->where('workspace_id', $workspaceId);
    }
}
