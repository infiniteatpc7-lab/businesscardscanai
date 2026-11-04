<?php

namespace App\Services;

use App\Models\AiApiRequest;
use App\Models\AiCostExchangeRate;
use App\Models\AiModelPricing;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AiCostCalculationService
{
    /**
     * Precision scale used for intermediate BCMath calculations.
     */
    public const BCMATH_SCALE = 12;

    /**
     * Precision scale used for final USD and INR currency values in database.
     */
    public const CURRENCY_DECIMALS = 6;

    /**
     * Calculate and persist the actual Gemini API costs for an individual AI request attempt.
     * Guaranteed to be idempotent and safe under concurrent execution.
     */
    public function calculateAndPersist(AiApiRequest $request, bool $force = false): ?AiApiRequest
    {
        try {
            return DB::transaction(function () use ($request, $force) {
                /** @var AiApiRequest|null $locked */
                $locked = AiApiRequest::where('id', $request->id)->lockForUpdate()->first();
                if (! $locked) {
                    return null;
                }

                // Historical integrity: never overwrite an already finalized request cost unless explicitly forced
                if ($locked->cost_calculation_status === 'calculated' && ! $force) {
                    return $locked;
                }

                $requestTime = $locked->started_at ?? $locked->created_at ?? now();

                $promptTokens = (int) $locked->prompt_tokens;
                $candidatesTokens = (int) $locked->candidates_tokens;
                $cachedTokens = (int) $locked->cached_tokens;
                $thoughtsTokens = (int) $locked->thoughts_tokens;
                $totalTokens = (int) $locked->total_tokens;

                // Handle zero-token / missing-usage requests (e.g. failed before reaching provider API)
                if ($totalTokens === 0 && $promptTokens === 0 && $candidatesTokens === 0) {
                    $locked->update([
                        'cost_usd' => 0.000000,
                        'cost_inr' => 0.000000,
                        'cost_calculation_status' => 'no_usage',
                        'cost_calculated_at' => now(),
                    ]);

                    return $locked;
                }

                $modelIdentifier = $locked->actual_model ?: $locked->requested_model;
                $pricing = $this->findApplicablePricing($modelIdentifier, $requestTime);

                if (! $pricing) {
                    $locked->update([
                        'cost_calculation_status' => 'pricing_missing',
                    ]);

                    return $locked;
                }

                // Provider Semantics: Avoid double-counting cached tokens
                // In Gemini API, promptTokenCount includes cachedContentTokenCount.
                $nonCachedPromptTokens = max(0, $promptTokens - $cachedTokens);

                // In Gemini API, candidatesTokenCount includes thoughtsTokenCount.
                $nonThoughtCandidateTokens = max(0, $candidatesTokens - $thoughtsTokens);

                $promptCost = $this->calcTokenCost($nonCachedPromptTokens, (string) $pricing->input_token_price_per_million);
                $cachedCost = $this->calcTokenCost($cachedTokens, (string) $pricing->cached_input_token_price_per_million);
                $candidatesCost = $this->calcTokenCost($nonThoughtCandidateTokens, (string) $pricing->output_token_price_per_million);
                $thoughtsCost = $this->calcTokenCost($thoughtsTokens, (string) $pricing->thoughts_token_price_per_million);

                $costUsdRaw = bcadd(
                    bcadd($promptCost, $cachedCost, self::BCMATH_SCALE),
                    bcadd($candidatesCost, $thoughtsCost, self::BCMATH_SCALE),
                    self::BCMATH_SCALE
                );

                $costUsdFormatted = number_format((float) $costUsdRaw, self::CURRENCY_DECIMALS, '.', '');

                $exchangeRate = $this->findApplicableExchangeRate($requestTime, 'USD', 'INR');

                if (! $exchangeRate) {
                    // When exchange rate is unavailable, preserve calculated USD cost while keeping INR pending
                    $locked->update([
                        'cost_usd' => $costUsdFormatted,
                        'cost_inr' => 0.000000,
                        'pricing_version' => $pricing->pricing_version,
                        'model_pricing_id' => $pricing->id,
                        'exchange_rate_id' => null,
                        'exchange_rate' => null,
                        'cost_calculation_status' => 'exchange_rate_missing',
                        'cost_calculated_at' => now(),
                    ]);

                    return $locked;
                }

                $rateStr = (string) $exchangeRate->exchange_rate;
                $costInrRaw = bcmul($costUsdRaw, $rateStr, self::BCMATH_SCALE);
                $costInrFormatted = number_format((float) $costInrRaw, self::CURRENCY_DECIMALS, '.', '');

                $locked->update([
                    'cost_usd' => $costUsdFormatted,
                    'cost_inr' => $costInrFormatted,
                    'pricing_version' => $pricing->pricing_version,
                    'model_pricing_id' => $pricing->id,
                    'exchange_rate_id' => $exchangeRate->id,
                    'exchange_rate' => $rateStr,
                    'cost_calculation_status' => 'calculated',
                    'cost_calculated_at' => now(),
                ]);

                return $locked;
            });
        } catch (\Throwable $e) {
            Log::error('AI cost calculation failed: '.$e->getMessage(), [
                'request_id' => $request->id,
                'request_uuid' => $request->request_uuid,
            ]);

            return null;
        }
    }

    /**
     * Calculate cost for a token category with high-precision decimal arithmetic.
     * Formula: (tokens * price_per_million) / 1,000,000
     */
    public function calcTokenCost(int $tokens, string $pricePerMillion): string
    {
        if ($tokens <= 0 || bccomp($pricePerMillion, '0', 6) <= 0) {
            return '0.000000000000';
        }

        $tokensStr = (string) $tokens;
        $millionProduct = bcmul($tokensStr, $pricePerMillion, self::BCMATH_SCALE);

        return bcdiv($millionProduct, '1000000', self::BCMATH_SCALE);
    }

    /**
     * Find the applicable model pricing based on model identifier and request timestamp.
     */
    public function findApplicablePricing(string $model, CarbonInterface|string $requestTime): ?AiModelPricing
    {
        $time = $requestTime instanceof CarbonInterface ? $requestTime : Carbon::parse($requestTime);

        return AiModelPricing::where('model_identifier', $model)
            ->where('is_active', true)
            ->where('effective_from', '<=', $time)
            ->where(function ($q) use ($time) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>', $time);
            })
            ->orderByDesc('effective_from')
            ->first();
    }

    /**
     * Find the applicable exchange rate based on currency pair and request timestamp.
     */
    public function findApplicableExchangeRate(
        CarbonInterface|string $requestTime,
        string $base = 'USD',
        string $target = 'INR'
    ): ?AiCostExchangeRate {
        $time = $requestTime instanceof CarbonInterface ? $requestTime : Carbon::parse($requestTime);
        $dateStr = $time->toDateString();

        return AiCostExchangeRate::where('base_currency', $base)
            ->where('target_currency', $target)
            ->where('is_active', true)
            ->where('effective_date', '<=', $dateStr)
            ->orderByDesc('effective_date')
            ->first();
    }

    /**
     * Explicit recalculation for auditing or pricing corrections.
     * Preserves an auditable record of the correction.
     */
    public function recalculate(AiApiRequest $request, bool $force = false, ?string $reason = null): ?AiApiRequest
    {
        $oldUsd = $request->cost_usd;
        $oldInr = $request->cost_inr;
        $oldStatus = $request->cost_calculation_status;

        $updated = $this->calculateAndPersist($request, $force);

        if ($updated && ($oldUsd != $updated->cost_usd || $oldInr != $updated->cost_inr || $oldStatus != $updated->cost_calculation_status)) {
            Log::info('AI API Request cost recalculated', [
                'request_id' => $request->id,
                'request_uuid' => $request->request_uuid,
                'old_cost_usd' => $oldUsd,
                'new_cost_usd' => $updated->cost_usd,
                'old_cost_inr' => $oldInr,
                'new_cost_inr' => $updated->cost_inr,
                'old_status' => $oldStatus,
                'new_status' => $updated->cost_calculation_status,
                'reason' => $reason ?? 'Recalculation requested',
            ]);
        }

        return $updated;
    }
}
