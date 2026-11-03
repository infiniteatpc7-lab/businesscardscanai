<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exhibition extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'created_by_user_id',
        'name',
        'organizer',
        'venue',
        'city',
        'start_date',
        'end_date',
        'description',
        'status',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    /**
     * Get the workspace that owns the exhibition.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Get the user who created the exhibition.
     */
    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * Get all cards captured or associated with this exhibition.
     */
    public function cards(): BelongsToMany
    {
        return $this->belongsToMany(Card::class, 'card_exhibitions')
            ->withPivot('created_at');
    }

    /**
     * Get all scan events recorded at this exhibition.
     */
    public function cardScans(): HasMany
    {
        return $this->hasMany(CardScan::class);
    }

    /**
     * Check if this exhibition is archived.
     */
    public function isArchived(): bool
    {
        return $this->status === 'archived';
    }

    /**
     * Check if this exhibition is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
