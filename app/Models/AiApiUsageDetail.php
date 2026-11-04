<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiApiUsageDetail extends Model
{
    use HasFactory;

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'ai_api_usage_details';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'ai_api_request_id',
        'prompt_tokens',
        'candidates_tokens',
        'thoughts_tokens',
        'cached_content_tokens',
        'total_tokens',
        'raw_usage_metadata',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'prompt_tokens' => 'integer',
            'candidates_tokens' => 'integer',
            'thoughts_tokens' => 'integer',
            'cached_content_tokens' => 'integer',
            'total_tokens' => 'integer',
            'raw_usage_metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Get the associated AI API request.
     */
    public function apiRequest(): BelongsTo
    {
        return $this->belongsTo(AiApiRequest::class, 'ai_api_request_id');
    }
}
