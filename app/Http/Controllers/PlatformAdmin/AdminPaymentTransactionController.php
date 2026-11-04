<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\PaymentTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPaymentTransactionController extends Controller
{
    /**
     * List payment transactions with filtering by customer, workspace, gateway, status, and dates.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PaymentTransaction::query()->with([
            'workspace:id,name,slug',
            'plan:id,name,slug,price,currency',
            'user:id,name,email',
        ]);

        // Filter by workspace ID
        if ($workspaceId = $request->input('workspace_id')) {
            $query->where('workspace_id', (int) $workspaceId);
        }

        // Filter by customer / user ID
        $customerId = $request->input('customer_id') ?? $request->input('user_id');
        if ($customerId) {
            $query->where('user_id', (int) $customerId);
        }

        // Filter by payment status: successful | pending | failed | refunded
        if ($status = $request->input('status')) {
            if ($status !== 'all' && in_array($status, ['successful', 'pending', 'failed', 'refunded'], true)) {
                $query->where('status', $status);
            }
        }

        // Filter by payment gateway: e.g. razorpay | stripe | manual
        if ($gateway = $request->input('gateway')) {
            if ($gateway !== 'all') {
                $query->where('gateway', strtolower(trim((string) $gateway)));
            }
        }

        // Filter by date range
        if ($startDate = $request->input('start_date')) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate = $request->input('end_date')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        // Search by reference IDs, workspace name, or customer email
        if ($search = trim((string) $request->input('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('gateway_payment_id', 'like', "%{$search}%")
                    ->orWhere('gateway_order_id', 'like', "%{$search}%")
                    ->orWhere('workspace_name', 'like', "%{$search}%")
                    ->orWhere('user_email', 'like', "%{$search}%")
                    ->orWhereHas('workspace', function ($wq) use ($search) {
                        $wq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
        $paginator = $query->latest('id')->paginate($perPage);

        // Map and sanitize transaction records to strictly safe fields
        $transactions = collect($paginator->items())->map(function (PaymentTransaction $tx) {
            $amount = (float) $tx->amount;
            $currency = $tx->currency ?: 'INR';
            $currencySymbol = ($currency === 'INR') ? '₹' : $currency;

            // Extract only safe public gateway metadata if present
            $rawResponse = is_array($tx->gateway_response) ? $tx->gateway_response : [];
            $safeMetadata = [];
            foreach (['method', 'bank', 'wallet', 'card_network', 'card_type', 'card_last4', 'fee', 'tax'] as $safeKey) {
                if (isset($rawResponse[$safeKey])) {
                    $safeMetadata[$safeKey] = $rawResponse[$safeKey];
                }
            }

            return [
                'id' => $tx->id,
                'workspace_id' => $tx->workspace_id,
                'workspace_name' => $tx->workspace_name ?? $tx->workspace?->name,
                'subscription_id' => $tx->subscription_id,
                'plan_id' => $tx->plan_id,
                'plan_name' => $tx->plan_name ?? $tx->plan?->name,
                'user_id' => $tx->user_id,
                'user_email' => $tx->user_email ?? $tx->user?->email,
                'customer_name' => $tx->user?->name,
                'amount' => $amount,
                'currency' => $currency,
                'currency_symbol' => $currencySymbol,
                'formatted_amount' => $currencySymbol.number_format($amount, 2),
                'gateway' => $tx->gateway,
                'gateway_order_id' => $tx->gateway_order_id,
                'gateway_payment_id' => $tx->gateway_payment_id,
                'status' => $tx->status,
                'paid_at' => $tx->paid_at?->toIso8601String(),
                'created_at' => $tx->created_at?->toIso8601String(),
                'error_message' => $tx->error_message,
                'safe_metadata' => $safeMetadata,
            ];
        });

        return response()->json([
            'success' => true,
            'transactions' => $transactions,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
