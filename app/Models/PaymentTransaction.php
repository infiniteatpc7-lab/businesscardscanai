<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class PaymentTransaction extends Model
{
    use HasFactory;

    protected $table = 'payment_transactions';

    /**
     * Never expose raw verification signatures in JSON serialized responses.
     * Note: gateway_signature must only store verification HMAC SHA256 hashes, never secrets or tokens.
     *
     * @var list<string>
     */
    protected $hidden = [
        'gateway_signature',
    ];

    /**
     * Allowed safe gateway metadata keys (PCI-DSS & Security compliance).
     *
     * @var list<string>
     */
    public const SAFE_GATEWAY_FIELDS = [
        'id',
        'order_id',
        'payment_id',
        'status',
        'method',
        'amount',
        'currency',
        'vpa',
        'bank',
        'wallet',
        'card_network',
        'card_type',
        'card_last4',
        'card_issuer',
        'fee',
        'tax',
        'error_code',
        'error_description',
        'created_at',
    ];

    /**
     * Explicit forbidden keys that must NEVER be stored (PAN, CVV, passwords, tokens, secrets).
     *
     * @var list<string>
     */
    public const SENSITIVE_KEYS_DENYLIST = [
        'card_number',
        'number',
        'pan',
        'cvv',
        'cvc',
        'security_code',
        'exp_month',
        'exp_year',
        'expiry_month',
        'expiry_year',
        'secret',
        'key_secret',
        'api_key',
        'token',
        'access_token',
        'auth_token',
        'webhook_secret',
        'private_key',
        'password',
        'pin',
        'otp',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'workspace_id',
        'workspace_name',
        'subscription_id',
        'plan_id',
        'plan_name',
        'user_id',
        'user_email',
        'amount',
        'currency',
        'gateway',
        'gateway_order_id',
        'gateway_payment_id',
        'gateway_signature',
        'status',
        'paid_at',
        'gateway_response',
        'error_message',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'gateway_response' => 'array',
        ];
    }

    /**
     * Sanitize incoming gateway response payload to strictly strip any sensitive fields.
     */
    public static function sanitizeGatewayResponse(array $payload): array
    {
        $sanitized = [];

        foreach ($payload as $key => $value) {
            $normalizedKey = strtolower(trim((string) $key));

            // Strip any sensitive forbidden key
            if (in_array($normalizedKey, self::SENSITIVE_KEYS_DENYLIST, true)) {
                continue;
            }

            if (is_array($value)) {
                $sanitized[$key] = self::sanitizeGatewayResponse($value);
            } elseif (is_scalar($value) || is_null($value)) {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }

    /**
     * Mutator for gateway_response ensuring sensitive card details/secrets are never saved.
     */
    public function setGatewayResponseAttribute($value): void
    {
        if (is_array($value)) {
            $this->attributes['gateway_response'] = json_encode(self::sanitizeGatewayResponse($value));
        } elseif (is_string($value)) {
            $decoded = json_decode($value, true);
            $this->attributes['gateway_response'] = is_array($decoded)
                ? json_encode(self::sanitizeGatewayResponse($decoded))
                : $value;
        } else {
            $this->attributes['gateway_response'] = null;
        }
    }

    /**
     * Boot model events for consistency validation and immutable snapshot preservation.
     */
    protected static function booted(): void
    {
        static::creating(function (PaymentTransaction $tx) {
            if ($tx->subscription_id && $tx->workspace_id) {
                $sub = WorkspaceSubscription::find($tx->subscription_id);
                if ($sub && (int) $sub->workspace_id !== (int) $tx->workspace_id) {
                    throw new InvalidArgumentException('Subscription does not belong to the specified workspace.');
                }
            }

            // Capture snapshots
            if (! $tx->workspace_name && $tx->workspace_id) {
                $tx->workspace_name = Workspace::find($tx->workspace_id)?->name;
            }

            if (! $tx->plan_name && $tx->plan_id) {
                $tx->plan_name = Plan::find($tx->plan_id)?->name;
            }

            if (! $tx->user_email && $tx->user_id) {
                $tx->user_email = User::find($tx->user_id)?->email;
            }
        });
    }

    /**
     * Workspace owning this payment transaction.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * Workspace Subscription referenced by this payment, if applicable.
     */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(WorkspaceSubscription::class, 'subscription_id');
    }

    /**
     * Plan purchased or subscribed to, if applicable.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    /**
     * Customer / team member who initiated or authorized this transaction.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isSuccessful(): bool
    {
        return $this->status === 'successful';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function isRefunded(): bool
    {
        return $this->status === 'refunded';
    }
}
