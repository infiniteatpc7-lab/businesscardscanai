<?php

namespace Database\Seeders;

use App\Models\AiCostExchangeRate;
use App\Models\AiModelPricing;
use Illuminate\Database\Seeder;

class AiPricingSeeder extends Seeder
{
    /**
     * Seed initial model pricing versions and exchange rates.
     */
    public function run(): void
    {
        // 1. USD to INR conversion rates
        // 1a. Planning baseline
        $baseline = AiCostExchangeRate::where('base_currency', 'USD')
            ->where('target_currency', 'INR')
            ->where('source', 'system')
            ->where(function ($q) {
                $q->where('effective_date', '2026-01-01')
                    ->orWhere('effective_date', 'like', '2026-01-01%');
            })
            ->first();

        if (! $baseline) {
            AiCostExchangeRate::create([
                'base_currency' => 'USD',
                'target_currency' => 'INR',
                'effective_date' => '2026-01-01',
                'source' => 'system',
                'exchange_rate' => 86.5000,
                'is_active' => true,
                'notes' => 'Baseline 2026 financial planning rate for USD to INR',
            ]);
        }

        // 1b. Verified FBIL reference rate
        $fbil = AiCostExchangeRate::where('base_currency', 'USD')
            ->where('target_currency', 'INR')
            ->where('source', 'fbil_reference')
            ->where(function ($q) {
                $q->where('effective_date', '2026-01-05')
                    ->orWhere('effective_date', 'like', '2026-01-05%');
            })
            ->first();

        if (! $fbil) {
            AiCostExchangeRate::create([
                'base_currency' => 'USD',
                'target_currency' => 'INR',
                'effective_date' => '2026-01-05',
                'source' => 'fbil_reference',
                'exchange_rate' => 89.4600,
                'is_active' => true,
                'notes' => 'FBIL official USD/INR reference benchmark rate for Jan 2026',
            ]);
        }

        // 2. Gemini model pricing catalogs
        // 2a. Historical baseline (2026-v1 preserved)
        $pricingCatalogV1 = [
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-3.5-flash',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 0.075000,
                'output_token_price_per_million' => 0.300000,
                'cached_input_token_price_per_million' => 0.018750,
                'thoughts_token_price_per_million' => 0.300000,
                'input_token_unit_price' => 0.0000000750,
                'output_token_unit_price' => 0.0000003000,
                'cached_input_token_unit_price' => 0.0000000188,
                'thoughts_token_unit_price' => 0.0000003000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini 3.5 Flash primary production vision model (historical baseline)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-3.5-flash-lite',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 0.037500,
                'output_token_price_per_million' => 0.150000,
                'cached_input_token_price_per_million' => 0.009375,
                'thoughts_token_price_per_million' => 0.150000,
                'input_token_unit_price' => 0.0000000375,
                'output_token_unit_price' => 0.0000001500,
                'cached_input_token_unit_price' => 0.0000000094,
                'thoughts_token_unit_price' => 0.0000001500,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini 3.5 Flash-Lite high-throughput low-latency model (historical baseline)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-flash-lite-latest',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 0.037500,
                'output_token_price_per_million' => 0.150000,
                'cached_input_token_price_per_million' => 0.009375,
                'thoughts_token_price_per_million' => 0.150000,
                'input_token_unit_price' => 0.0000000375,
                'output_token_unit_price' => 0.0000001500,
                'cached_input_token_unit_price' => 0.0000000094,
                'thoughts_token_unit_price' => 0.0000001500,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini Flash-Lite alias (historical baseline)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-3.8-flash',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 0.075000,
                'output_token_price_per_million' => 0.300000,
                'cached_input_token_price_per_million' => 0.018750,
                'thoughts_token_price_per_million' => 0.300000,
                'input_token_unit_price' => 0.0000000750,
                'output_token_unit_price' => 0.000003000,
                'cached_input_token_unit_price' => 0.0000000188,
                'thoughts_token_unit_price' => 0.0000003000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini 3.8 Flash high-accuracy fallback model (historical baseline)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-2.5-flash',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 0.075000,
                'output_token_price_per_million' => 0.300000,
                'cached_input_token_price_per_million' => 0.018750,
                'thoughts_token_price_per_million' => 0.300000,
                'input_token_unit_price' => 0.0000000750,
                'output_token_unit_price' => 0.0000003000,
                'cached_input_token_unit_price' => 0.0000000188,
                'thoughts_token_unit_price' => 0.0000003000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini 2.5 Flash standard multimodal tier (historical baseline)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-1.5-flash',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 0.075000,
                'output_token_price_per_million' => 0.300000,
                'cached_input_token_price_per_million' => 0.018750,
                'thoughts_token_price_per_million' => 0.300000,
                'input_token_unit_price' => 0.0000000750,
                'output_token_unit_price' => 0.0000003000,
                'cached_input_token_unit_price' => 0.0000000188,
                'thoughts_token_unit_price' => 0.0000003000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini 1.5 Flash fallback multimodal tier (historical baseline)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-1.5-pro',
                'pricing_version' => '2026-v1',
                'input_token_price_per_million' => 1.250000,
                'output_token_price_per_million' => 5.000000,
                'cached_input_token_price_per_million' => 0.312500,
                'thoughts_token_price_per_million' => 5.000000,
                'input_token_unit_price' => 0.0000012500,
                'output_token_unit_price' => 0.0000050000,
                'cached_input_token_unit_price' => 0.0000003125,
                'thoughts_token_unit_price' => 0.0000050000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Gemini 1.5 Pro high-reasoning tier (historical baseline)',
            ],
        ];

        // 2b. Verified Authoritative Rates (2026-v2)
        // Source: https://ai.google.dev/gemini-api/docs/pricing, verified 2026-11-04
        $pricingCatalogV2 = [
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-3.5-flash',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 1.500000,
                'output_token_price_per_million' => 9.000000,
                'cached_input_token_price_per_million' => 0.150000,
                'thoughts_token_price_per_million' => 9.000000,
                'input_token_unit_price' => 0.0000015000,
                'output_token_unit_price' => 0.0000090000,
                'cached_input_token_unit_price' => 0.0000001500,
                'thoughts_token_unit_price' => 0.0000090000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Standard pay-as-you-go)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-3.5-flash-lite',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 0.300000,
                'output_token_price_per_million' => 2.500000,
                'cached_input_token_price_per_million' => 0.030000,
                'thoughts_token_price_per_million' => 2.500000,
                'input_token_unit_price' => 0.0000003000,
                'output_token_unit_price' => 0.0000025000,
                'cached_input_token_unit_price' => 0.0000000300,
                'thoughts_token_unit_price' => 0.0000025000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Flash-Lite Standard tier)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-flash-lite-latest',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 0.300000,
                'output_token_price_per_million' => 2.500000,
                'cached_input_token_price_per_million' => 0.030000,
                'thoughts_token_price_per_million' => 2.500000,
                'input_token_unit_price' => 0.0000003000,
                'output_token_unit_price' => 0.0000025000,
                'cached_input_token_unit_price' => 0.0000000300,
                'thoughts_token_unit_price' => 0.0000025000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Flash-Lite latest alias)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-3.8-flash',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 0.750000,
                'output_token_price_per_million' => 3.750000,
                'cached_input_token_price_per_million' => 0.075000,
                'thoughts_token_price_per_million' => 3.750000,
                'input_token_unit_price' => 0.0000007500,
                'output_token_unit_price' => 0.0000037500,
                'cached_input_token_unit_price' => 0.0000000750,
                'thoughts_token_unit_price' => 0.0000037500,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Gemini 3.8 Flash tier)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-2.5-flash',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 0.300000,
                'output_token_price_per_million' => 2.500000,
                'cached_input_token_price_per_million' => 0.030000,
                'thoughts_token_price_per_million' => 2.500000,
                'input_token_unit_price' => 0.0000003000,
                'output_token_unit_price' => 0.0000025000,
                'cached_input_token_unit_price' => 0.0000000300,
                'thoughts_token_unit_price' => 0.0000025000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Gemini 2.5 Flash Standard tier)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-1.5-flash',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 0.075000,
                'output_token_price_per_million' => 0.300000,
                'cached_input_token_price_per_million' => 0.018750,
                'thoughts_token_price_per_million' => 0.300000,
                'input_token_unit_price' => 0.0000000750,
                'output_token_unit_price' => 0.0000003000,
                'cached_input_token_unit_price' => 0.0000000188,
                'thoughts_token_unit_price' => 0.0000003000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Gemini 1.5 Flash tier)',
            ],
            [
                'provider' => 'google',
                'model_identifier' => 'gemini-1.5-pro',
                'pricing_version' => '2026-v2',
                'input_token_price_per_million' => 1.250000,
                'output_token_price_per_million' => 5.000000,
                'cached_input_token_price_per_million' => 0.312500,
                'thoughts_token_price_per_million' => 5.000000,
                'input_token_unit_price' => 0.0000012500,
                'output_token_unit_price' => 0.0000050000,
                'cached_input_token_unit_price' => 0.0000003125,
                'thoughts_token_unit_price' => 0.0000050000,
                'currency' => 'USD',
                'effective_from' => '2026-01-01 00:00:00',
                'is_active' => true,
                'notes' => 'Verified 2026-11-04 via https://ai.google.dev/gemini-api/docs/pricing (Gemini 1.5 Pro standard tier)',
            ],
        ];

        foreach (array_merge($pricingCatalogV1, $pricingCatalogV2) as $pricing) {
            $existingPricing = AiModelPricing::where('provider', $pricing['provider'])
                ->where('model_identifier', $pricing['model_identifier'])
                ->where('pricing_version', $pricing['pricing_version'])
                ->first();

            if (! $existingPricing) {
                AiModelPricing::create($pricing);
            }
        }
    }
}
