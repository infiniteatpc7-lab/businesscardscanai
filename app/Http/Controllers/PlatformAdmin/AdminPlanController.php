<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminPlanController extends Controller
{
    /**
     * List all plans with active subscription counts.
     */
    public function index(): JsonResponse
    {
        $plans = Plan::withCount(['subscriptions as active_subscriptions_count' => function ($sq) {
            $sq->where('status', 'active');
        }])->orderBy('price', 'asc')->get();

        return response()->json([
            'success' => true,
            'plans' => $plans->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'price' => (float) $plan->price,
                'currency' => $plan->currency,
                'billing_interval' => $plan->billing_interval,
                'monthly_scan_allowance' => (int) $plan->monthly_scan_allowance,
                'features' => $plan->features ?? [],
                'is_active' => (bool) $plan->is_active,
                'active_subscriptions_count' => (int) $plan->active_subscriptions_count,
                'created_at' => $plan->created_at?->toIso8601String(),
                'updated_at' => $plan->updated_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Create a new SaaS plan.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:100|unique:plans,slug',
            'price' => 'required|numeric|min:0|max:999999.99',
            'currency' => 'nullable|string|size:3',
            'billing_interval' => 'nullable|string|in:monthly,yearly',
            'monthly_scan_allowance' => 'required|integer|min:0|max:10000000',
            'features' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $plan = Plan::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'price' => $validated['price'],
            'currency' => strtoupper($validated['currency'] ?? 'USD'),
            'billing_interval' => $validated['billing_interval'] ?? 'monthly',
            'monthly_scan_allowance' => $validated['monthly_scan_allowance'],
            'features' => $validated['features'] ?? [],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        PlatformAuditLog::record(
            $admin,
            'plan.create',
            $plan,
            [
                'plan_name' => $plan->name,
                'slug' => $plan->slug,
                'monthly_allowance' => $plan->monthly_scan_allowance,
                'price' => $plan->price,
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Plan created successfully.',
            'plan' => $plan,
        ], 201);
    }

    /**
     * Update an existing plan.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');
        $plan = Plan::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => ['nullable', 'string', 'max:100', Rule::unique('plans', 'slug')->ignore($plan->id)],
            'price' => 'required|numeric|min:0|max:999999.99',
            'currency' => 'nullable|string|size:3',
            'billing_interval' => 'nullable|string|in:monthly,yearly',
            'monthly_scan_allowance' => 'required|integer|min:0|max:10000000',
            'features' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        $before = [
            'name' => $plan->name,
            'price' => (float) $plan->price,
            'allowance' => $plan->monthly_scan_allowance,
            'is_active' => $plan->is_active,
        ];

        $plan->update([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? $plan->slug,
            'price' => $validated['price'],
            'currency' => strtoupper($validated['currency'] ?? $plan->currency),
            'billing_interval' => $validated['billing_interval'] ?? $plan->billing_interval,
            'monthly_scan_allowance' => $validated['monthly_scan_allowance'],
            'features' => $validated['features'] ?? $plan->features,
            'is_active' => $validated['is_active'] ?? $plan->is_active,
        ]);

        PlatformAuditLog::record(
            $admin,
            'plan.update',
            $plan,
            [
                'plan_name' => $plan->name,
                'changes' => [
                    'before' => $before,
                    'after' => [
                        'name' => $plan->name,
                        'price' => (float) $plan->price,
                        'allowance' => $plan->monthly_scan_allowance,
                        'is_active' => $plan->is_active,
                    ],
                ],
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Plan updated successfully.',
            'plan' => $plan,
        ]);
    }

    /**
     * Toggle plan active/inactive status safely.
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');
        $plan = Plan::findOrFail($id);

        $newStatus = ! $plan->is_active;
        $plan->update(['is_active' => $newStatus]);

        PlatformAuditLog::record(
            $admin,
            $newStatus ? 'plan.activate' : 'plan.deactivate',
            $plan,
            [
                'plan_name' => $plan->name,
                'is_active' => $newStatus,
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => "Plan '{$plan->name}' has been ".($newStatus ? 'activated' : 'deactivated').'.',
            'plan' => $plan,
        ]);
    }
}
