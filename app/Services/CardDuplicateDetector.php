<?php

namespace App\Services;

use App\Models\Card;

class CardDuplicateDetector
{
    /**
     * Normalize a phone number to canonical representation.
     * Handles spaces, hyphens, brackets, dots, and +91 / 0 prefixes for Indian numbers.
     */
    public function normalizePhone(?string $phone): ?string
    {
        if (! $phone) {
            return null;
        }

        // Extract digits only
        $digits = preg_replace('/[^0-9]/', '', $phone);

        if (empty($digits)) {
            return null;
        }

        // Indian country code & leading zero normalization
        // 12 digits starting with 91 -> strip 91
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        }
        // 11 digits starting with 0 -> strip 0
        elseif (strlen($digits) === 11 && str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        // Ignore dummy strings or numbers that are too short to be unique (minimum 6 digits)
        if (strlen($digits) < 6 || preg_match('/^0+$/', $digits)) {
            return null;
        }

        return $digits;
    }

    /**
     * Normalize an email address for comparison.
     */
    public function normalizeEmail(?string $email): ?string
    {
        if (! $email) {
            return null;
        }

        $cleaned = strtolower(trim($email));

        if (! filter_var($cleaned, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return $cleaned;
    }

    /**
     * Normalize names/companies: lowercase, collapse spaces.
     */
    public function normalizeText(?string $text): ?string
    {
        if (! $text) {
            return null;
        }

        $cleaned = mb_strtolower(trim($text), 'UTF-8');
        $cleaned = preg_replace('/\s+/', ' ', $cleaned);

        if (mb_strlen($cleaned) < 2) {
            return null;
        }

        return $cleaned;
    }

    /**
     * Detect matching duplicates among existing cards.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{
     *     has_duplicates: bool,
     *     primary_reason: ?string,
     *     matching_cards: array<int, array<string, mixed>>
     * }
     */
    public function detectDuplicates(array $attributes, ?int $workspaceId = null): array
    {
        // 1. Incoming phones
        $incomingRawPhones = $attributes['phone'] ?? [];
        if (! is_array($incomingRawPhones)) {
            $incomingRawPhones = is_string($incomingRawPhones) && ! empty($incomingRawPhones)
                ? [$incomingRawPhones]
                : [];
        }

        $incomingNormalizedPhones = [];
        foreach ($incomingRawPhones as $ph) {
            if ($normalized = $this->normalizePhone((string) $ph)) {
                $incomingNormalizedPhones[] = $normalized;
            }
        }
        $incomingNormalizedPhones = array_unique($incomingNormalizedPhones);

        // 2. Incoming email
        $incomingNormalizedEmail = $this->normalizeEmail($attributes['email'] ?? null);

        // 3. Incoming names and companies
        $incomingName = $this->normalizeText($attributes['name'] ?? null);
        $incomingNameEn = $this->normalizeText($attributes['name_english'] ?? null);
        $incomingCompany = $this->normalizeText($attributes['company'] ?? null);
        $incomingCompanyEn = $this->normalizeText($attributes['company_english'] ?? null);

        $matches = [];

        // Query existing cards (scoped to workspace when provided)
        $query = Card::query();
        if ($workspaceId !== null) {
            $query->where('workspace_id', $workspaceId);
        }
        $existingCards = $query->get();

        foreach ($existingCards as $existing) {
            $reasons = [];
            $matchedValue = null;

            // A. Check Phone matches (Strong match)
            if (! empty($incomingNormalizedPhones)) {
                $existingRawPhones = $existing->phone ?? [];
                if (! is_array($existingRawPhones)) {
                    $existingRawPhones = is_string($existingRawPhones) ? [$existingRawPhones] : [];
                }

                foreach ($existingRawPhones as $exPhone) {
                    $normalizedEx = $this->normalizePhone((string) $exPhone);
                    if ($normalizedEx && in_array($normalizedEx, $incomingNormalizedPhones, true)) {
                        $reasons[] = 'phone';
                        $matchedValue = $exPhone;
                        break;
                    }
                }
            }

            // B. Check Email matches (Strong match)
            if ($incomingNormalizedEmail) {
                $existingEmail = $this->normalizeEmail($existing->email);
                if ($existingEmail && $existingEmail === $incomingNormalizedEmail) {
                    $reasons[] = 'email';
                    if (! $matchedValue) {
                        $matchedValue = $existing->email;
                    }
                }
            }

            // C. Check Person Name + Company matches (Possible match)
            // Important: Company name alone must NEVER trigger a duplicate.
            $hasNameMatch = false;
            $hasCompanyMatch = false;

            $existingName = $this->normalizeText($existing->name);
            $existingNameEn = $this->normalizeText($existing->name_english);
            $existingCompany = $this->normalizeText($existing->company);
            $existingCompanyEn = $this->normalizeText($existing->company_english);

            // Name match: check original or english
            if ($incomingName && ($incomingName === $existingName || $incomingName === $existingNameEn)) {
                $hasNameMatch = true;
            } elseif ($incomingNameEn && ($incomingNameEn === $existingName || $incomingNameEn === $existingNameEn)) {
                $hasNameMatch = true;
            }

            // Company match: check original or english
            if ($incomingCompany && ($incomingCompany === $existingCompany || $incomingCompany === $existingCompanyEn)) {
                $hasCompanyMatch = true;
            } elseif ($incomingCompanyEn && ($incomingCompanyEn === $existingCompany || $incomingCompanyEn === $existingCompanyEn)) {
                $hasCompanyMatch = true;
            }

            if ($hasNameMatch && $hasCompanyMatch) {
                $reasons[] = 'name_company';
                if (! $matchedValue) {
                    $matchedValue = ($existing->name ?: $existing->name_english).' - '.($existing->company ?: $existing->company_english);
                }
            }

            if (! empty($reasons)) {
                $matches[] = [
                    'id' => $existing->id,
                    'name' => $existing->name ?: $existing->name_english,
                    'company' => $existing->company ?: $existing->company_english,
                    'phone' => $existing->phone,
                    'email' => $existing->email,
                    'image_path' => $existing->image_path,
                    'match_reasons' => array_values(array_unique($reasons)),
                    'matched_value' => $matchedValue,
                ];
            }
        }

        if (empty($matches)) {
            return [
                'has_duplicates' => false,
                'primary_reason' => null,
                'matching_cards' => [],
            ];
        }

        // Determine primary match reason: phone > email > name_company
        $allReasons = [];
        foreach ($matches as $m) {
            foreach ($m['match_reasons'] as $r) {
                $allReasons[] = $r;
            }
        }

        $primaryReason = 'name_company';
        if (in_array('phone', $allReasons, true)) {
            $primaryReason = 'phone';
        } elseif (in_array('email', $allReasons, true)) {
            $primaryReason = 'email';
        }

        return [
            'has_duplicates' => true,
            'primary_reason' => $primaryReason,
            'matching_cards' => $matches,
        ];
    }
}
