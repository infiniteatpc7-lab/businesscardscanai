<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    /**
     * Categorized Feature Library.
     * Each feature has a stable key, human-readable name, description and category.
     */
    public const FEATURE_CATALOG = [
        'scanning_ai' => [
            'category' => 'Scanning & AI',
            'features' => [
                'single_card_scan' => [
                    'name' => 'Single Card Scanning',
                    'description' => 'Fast camera capture & Gemini Vision AI extraction',
                ],
                'high_accuracy_ocr' => [
                    'name' => 'Multilingual & Regional OCR',
                    'description' => 'High-accuracy OCR for Gujarati, Hindi, Arabic, Japanese, etc.',
                ],
                'auto_crop_enhancement' => [
                    'name' => 'Auto Crop & Enhancement',
                    'description' => 'Automatic border detection, perspective skew correction, and lighting tuning',
                ],
                'reverse_card_scan' => [
                    'name' => 'Back-of-Card Capture',
                    'description' => 'Scan and link reverse side of business cards for complete notes',
                ],
            ],
        ],
        'contact_management' => [
            'category' => 'Contact Management',
            'features' => [
                'duplicate_detection' => [
                    'name' => 'Smart Duplicate Detection',
                    'description' => 'Live phone, email, and name+company collision protection',
                ],
                'contact_notes_history' => [
                    'name' => 'Notes & Scan History',
                    'description' => 'Track multiple booth interactions and conversation notes',
                ],
                'contact_enrichment' => [
                    'name' => 'Smart Contact Enrichment',
                    'description' => 'Auto-generate social links, WhatsApp shortcuts, and website lookups',
                ],
                'custom_tags' => [
                    'name' => 'Custom Tags & Badges',
                    'description' => 'Tag contacts by interest, product lines, or priority status',
                ],
            ],
        ],
        'exhibition_management' => [
            'category' => 'Exhibition Management',
            'features' => [
                'exhibition_tracking' => [
                    'name' => 'Exhibition Event Tracking',
                    'description' => 'Tag cards with active trade shows and booth locations',
                ],
                'multi_exhibition_link' => [
                    'name' => 'Cross-Exhibition Linking',
                    'description' => 'Connect repeat contacts across multiple expos with separate scan history',
                ],
                'exhibition_analytics' => [
                    'name' => 'Exhibition Lead Analytics',
                    'description' => 'Visitor metrics and top scanning performance reports',
                ],
            ],
        ],
        'team_workspace' => [
            'category' => 'Team & Workspace',
            'features' => [
                'shared_workspace' => [
                    'name' => 'Shared Team Directory',
                    'description' => 'Centralized card library accessible to all authorized team members',
                ],
                'member_privacy' => [
                    'name' => 'Member Card Privacy',
                    'description' => 'Staff members only see their own scanned contacts until shared',
                ],
                'role_permissions' => [
                    'name' => 'Role-Based Access Control',
                    'description' => 'Owner, Admin, and Member permissions',
                ],
                'audit_logging' => [
                    'name' => 'Security Audit Logs',
                    'description' => 'Track team actions, logins, exports, and security events',
                ],
            ],
        ],
        'import_export' => [
            'category' => 'Import & Export',
            'features' => [
                'bulk_import' => [
                    'name' => 'Bulk Multi-Photo Import',
                    'description' => 'Upload and process batches of card images at once',
                ],
                'export_csv' => [
                    'name' => 'Export to CSV',
                    'description' => 'Download contacts spreadsheet compatible with Google Sheets & CRM',
                ],
                'export_excel' => [
                    'name' => 'Export to Excel (.xlsx)',
                    'description' => 'Download structured Microsoft Excel formatted workbooks',
                ],
                'api_access' => [
                    'name' => 'Developer API Access',
                    'description' => 'Access REST endpoints for custom CRM and webhook integrations',
                ],
            ],
        ],
        'support' => [
            'category' => 'Support',
            'features' => [
                'community_support' => [
                    'name' => 'Standard Email Support',
                    'description' => 'Response within 48 business hours',
                ],
                'priority_support' => [
                    'name' => 'Priority Support',
                    'description' => 'Fast-track email and WhatsApp support within 4 hours',
                ],
                'dedicated_account_manager' => [
                    'name' => 'Dedicated Account Manager',
                    'description' => 'Direct phone assistance and exhibition onboarding SLA',
                ],
            ],
        ],
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'currency',
        'monthly_scan_allowance',
        'max_team_members',
        'max_workspaces',
        'max_active_exhibitions',
        'invoice_interval',
        'is_active',
        'is_default',
        'features',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'monthly_scan_allowance' => 'integer',
            'max_team_members' => 'integer',
            'max_workspaces' => 'integer',
            'max_active_exhibitions' => 'integer',
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'features' => 'array',
        ];
    }

    /**
     * Subscriptions attached to this plan.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(WorkspaceSubscription::class);
    }

    /**
     * Scope for active plans.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Resolve the default Free Plan for new workspaces.
     */
    public static function getDefaultPlan(): ?self
    {
        return self::where('is_default', true)->where('is_active', true)->first()
            ?? self::where('slug', 'free')->first()
            ?? self::first();
    }

    /**
     * Check if the plan is active.
     */
    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    /**
     * Check if the plan is free.
     */
    public function isFree(): bool
    {
        return (float) $this->price === 0.0 || $this->slug === 'free';
    }

    /**
     * Check if a specific feature key is included in this plan.
     */
    public function hasFeature(string $featureKey): bool
    {
        $features = $this->features;
        if (! is_array($features)) {
            return false;
        }

        return in_array($featureKey, $features, true);
    }

    /**
     * Check if an entitlement is unlimited (-1).
     */
    public function isUnlimited(string $attribute): bool
    {
        return ((int) $this->getAttribute($attribute)) === -1;
    }

    /**
     * Get all valid feature keys defined in the catalog.
     *
     * @return list<string>
     */
    public static function getAllValidFeatureKeys(): array
    {
        $keys = [];
        foreach (self::FEATURE_CATALOG as $group) {
            foreach (array_keys($group['features']) as $key) {
                $keys[] = $key;
            }
        }

        return $keys;
    }

    /**
     * Subscription history entries where this plan was assigned.
     */
    public function subscriptionHistories(): HasMany
    {
        return $this->hasMany(WorkspaceSubscriptionHistory::class, 'plan_id');
    }

    /**
     * Payment transactions related to this plan.
     */
    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class, 'plan_id');
    }
}
