<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Card extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'user_id',
        'company',
        'company_english',
        'name',
        'name_english',
        'designation',
        'department',
        'phone',
        'email',
        'website',
        'address',
        'address_english',
        'tagline_services',
        'tax_id',
        'social_profiles',
        'accuracy_score',
        'accuracy_reason',
        'detected_language',
        'image_path',
        'raw_data',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'phone' => 'array',
            'social_profiles' => 'array',
            'raw_data' => 'array',
            'accuracy_score' => 'integer',
        ];
    }

    /**
     * Get the workspace that owns the business card.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Get the user who scanned or saved the card.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope a query to only include cards in a given workspace.
     */
    public function scopeForWorkspace(Builder $query, int $workspaceId): Builder
    {
        return $query->where('workspace_id', $workspaceId);
    }
}
