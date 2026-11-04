<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminPlanController extends Controller
{
    /**
     * List all plans with active subscription counts and the feature catalog.
     */
    public function index(): JsonResponse
    {
        $plans = Plan::withCount(['subscriptions as active_subscriptions_count' => function ($sq) {
            $sq->where('status', 'active');
        }])->orderBy('price', 'asc')->get();

        return response()->json([
            'success' => true,
            'currency' => 'INR',
            'currency_symbol' => '₹',
            'feature_catalog' => Plan::FEATURE_CATALOG,
            'plans' => $plans->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'description' => $plan->description,
                'price' => (float) $plan->price,
                'formatted_price' => '₹'.number_format((float) $plan->price, 2),
                'currency' => 'INR',
                'invoice_interval' => in_array($plan->invoice_interval, ['year', 'yearly'], true) ? 'year' : 'month',
                'monthly_scan_allowance' => (int) $plan->monthly_scan_allowance,
                'max_team_members' => (int) ($plan->max_team_members ?? 1),
                'max_workspaces' => (int) ($plan->max_workspaces ?? 1),
                'max_active_exhibitions' => (int) ($plan->max_active_exhibitions ?? 1),
                'is_unlimited_scans' => ((int) $plan->monthly_scan_allowance) === -1,
                'is_unlimited_team' => ((int) $plan->max_team_members) === -1,
                'is_unlimited_workspaces' => ((int) $plan->max_workspaces) === -1,
                'is_unlimited_exhibitions' => ((int) $plan->max_active_exhibitions) === -1,
                'features' => $plan->features ?? [],
                'is_active' => (bool) $plan->is_active,
                'is_default' => (bool) $plan->is_default,
                'active_subscriptions_count' => (int) $plan->active_subscriptions_count,
                'created_at' => $plan->created_at?->toIso8601String(),
                'updated_at' => $plan->updated_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Return categorized feature library definition.
     */
    public function features(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'catalog' => Plan::FEATURE_CATALOG,
            'valid_keys' => Plan::getAllValidFeatureKeys(),
        ]);
    }

    /**
     * Create a new SaaS plan with INR defaults and structured limits.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $validFeatureKeys = Plan::getAllValidFeatureKeys();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:100|unique:plans,slug',
            'description' => 'nullable|string|max:1000',
            'price' => 'required|numeric|min:0|max:9999999.99',
            'currency' => 'nullable|string|in:INR',
            'invoice_interval' => 'nullable|string|in:month,year,monthly,yearly',
            'monthly_scan_allowance' => 'required|integer|min:-1|max:10000000',
            'max_team_members' => 'required|integer|min:-1|max:100000',
            'max_workspaces' => 'required|integer|min:-1|max:10000',
            'max_active_exhibitions' => 'required|integer|min:-1|max:10000',
            'features' => 'nullable|array',
            'features.*' => ['string', Rule::in($validFeatureKeys)],
            'is_active' => 'nullable|boolean',
            'is_default' => 'nullable|boolean',
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $interval = in_array($validated['invoice_interval'] ?? 'month', ['year', 'yearly'], true) ? 'year' : 'month';
        $isDefault = (bool) ($validated['is_default'] ?? false);

        $plan = DB::transaction(function () use ($validated, $interval, $isDefault) {
            if ($isDefault) {
                Plan::query()->update(['is_default' => false]);
            }

            return Plan::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'description' => $validated['description'] ?? null,
                'price' => $validated['price'],
                'currency' => 'INR',
                'invoice_interval' => $interval,
                'monthly_scan_allowance' => $validated['monthly_scan_allowance'],
                'max_team_members' => $validated['max_team_members'],
                'max_workspaces' => $validated['max_workspaces'],
                'max_active_exhibitions' => $validated['max_active_exhibitions'],
                'features' => array_values(array_unique($validated['features'] ?? [])),
                'is_active' => $validated['is_active'] ?? true,
                'is_default' => $isDefault,
            ]);
        });

        PlatformAuditLog::record(
            $admin,
            'plan.create',
            $plan,
            [
                'plan_name' => $plan->name,
                'slug' => $plan->slug,
                'currency' => 'INR',
                'price' => (float) $plan->price,
                'monthly_allowance' => $plan->monthly_scan_allowance,
                'is_default' => $plan->is_default,
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
     * Update an existing plan with INR defaults and structured limits.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');
        $plan = Plan::findOrFail($id);

        $validFeatureKeys = Plan::getAllValidFeatureKeys();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => ['nullable', 'string', 'max:100', Rule::unique('plans', 'slug')->ignore($plan->id)],
            'description' => 'nullable|string|max:1000',
            'price' => 'required|numeric|min:0|max:9999999.99',
            'currency' => 'nullable|string|in:INR',
            'invoice_interval' => 'nullable|string|in:month,year,monthly,yearly',
            'monthly_scan_allowance' => 'required|integer|min:-1|max:10000000',
            'max_team_members' => 'required|integer|min:-1|max:100000',
            'max_workspaces' => 'required|integer|min:-1|max:10000',
            'max_active_exhibitions' => 'required|integer|min:-1|max:10000',
            'features' => 'nullable|array',
            'features.*' => ['string', Rule::in($validFeatureKeys)],
            'is_active' => 'nullable|boolean',
            'is_default' => 'nullable|boolean',
        ]);

        $before = [
            'name' => $plan->name,
            'price' => (float) $plan->price,
            'allowance' => $plan->monthly_scan_allowance,
            'max_team_members' => $plan->max_team_members,
            'is_active' => $plan->is_active,
            'is_default' => $plan->is_default,
        ];

        $interval = in_array($validated['invoice_interval'] ?? $plan->invoice_interval, ['year', 'yearly'], true) ? 'year' : 'month';
        $isDefault = array_key_exists('is_default', $validated) ? (bool) $validated['is_default'] : (bool) $plan->is_default;

        DB::transaction(function () use ($plan, $validated, $interval, $isDefault) {
            if ($isDefault && ! $plan->is_default) {
                Plan::where('id', '!=', $plan->id)->update(['is_default' => false]);
            }

            $plan->update([
                'name' => $validated['name'],
                'slug' => $validated['slug'] ?? $plan->slug,
                'description' => $validated['description'] ?? $plan->description,
                'price' => $validated['price'],
                'currency' => 'INR',
                'invoice_interval' => $interval,
                'monthly_scan_allowance' => $validated['monthly_scan_allowance'],
                'max_team_members' => $validated['max_team_members'],
                'max_workspaces' => $validated['max_workspaces'],
                'max_active_exhibitions' => $validated['max_active_exhibitions'],
                'features' => array_values(array_unique($validated['features'] ?? $plan->features ?? [])),
                'is_active' => $validated['is_active'] ?? $plan->is_active,
                'is_default' => $isDefault,
            ]);
        });

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
                        'max_team_members' => $plan->max_team_members,
                        'is_active' => $plan->is_active,
                        'is_default' => $plan->is_default,
                    ],
                ],
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Plan updated successfully.',
            'plan' => $plan->fresh(),
        ]);
    }

    /**
     * Toggle plan active/inactive status safely.
     * Deactivating does not cancel existing subscriber workspaces.
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');
        $plan = Plan::findOrFail($id);

        $newStatus = ! $plan->is_active;

        // Safeguard: Do not deactivate the default Free Plan unless another is set
        if (! $newStatus && $plan->is_default) {
            $otherDefault = Plan::where('id', '!=', $plan->id)->where('is_active', true)->where('is_default', true)->exists();
            if (! $otherDefault) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot deactivate the default Free Plan. Please designate another active plan as default first.',
                ], 422);
            }
        }

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
