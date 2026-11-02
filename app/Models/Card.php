<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Card extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
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
     * Get the attributes that should be cast.
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
}
