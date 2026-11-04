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
        // 1. Initial USD to INR conversion rate
        AiCostExchangeRate::firstOrCreate(
            [
                'base_currency' => 'USD',
                'target_currency' => 'INR',
                'effective_date' => '2026-01-01',
                'source' => 'system',
            ],
            [
                'exchange_rate' => 86.5000,
                'is_active' => true,
                'notes' => 'Baseline 2026 financial planning rate for USD to INR',
            ]
        );

        // 2. Initial Gemini model pricing (Google AI Studio rates as of 2026)
        $pricingCatalog = [
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
                'notes' => 'Gemini 2.5 Flash standard multimodal tier',
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
                'notes' => 'Gemini 1.5 Flash fallback multimodal tier',
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
                'notes' => 'Gemini 1.5 Pro high-reasoning tier',
            ],
        ];

        foreach ($pricingCatalog as $pricing) {
            AiModelPricing::firstOrCreate(
                [
                    'provider' => $pricing['provider'],
                    'model_identifier' => $pricing['model_identifier'],
                    'pricing_version' => $pricing['pricing_version'],
                ],
                $pricing
            );
        }
    }
}
