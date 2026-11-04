<?php

namespace App\Services;

use App\Models\AiApiRequest;
use App\Models\AiApiUsageDetail;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiUsageTrackingService
{
    /**
     * Error category constants.
     */
    public const ERROR_AUTHENTICATION = 'authentication_error';

    public const ERROR_RATE_LIMIT = 'rate_limit';

    public const ERROR_TIMEOUT = 'timeout';

    public const ERROR_NETWORK = 'network_error';

    public const ERROR_PROVIDER = 'provider_error';

    public const ERROR_INVALID_RESPONSE = 'invalid_response';

    public const ERROR_UNKNOWN = 'unknown_error';

    /**
     * Record an individual Gemini API execution attempt with token usage details.
     * Guaranteed to never throw and never interrupt core scanning workflow.
     */
    public function recordAttempt(
        string $scanType,
        string $requestedModel,
        ?string $actualModel,
        int $attemptNumber,
        bool $isFallback,
        ?string $fallbackReason,
        ?int $parentRequestId,
        int $imageCount,
        string $status,
        ?int $httpStatus,
        ?string $errorCode,
        ?string $errorMessage,
        ?CarbonInterface $startedAt = null,
        ?CarbonInterface $completedAt = null,
        ?int $durationMs = null,
        ?array $usageMetadata = null,
        array $attribution = [],
        array $references = []
    ): ?AiApiRequest {
        try {
            $workspaceId = $attribution['workspace_id'] ?? null;
            $workspaceName = $attribution['workspace_name'] ?? null;
            if ($workspaceId && ! $workspaceName) {
                $workspaceName = Workspace::where('id', $workspaceId)->value('name');
            }

            $userId = $attribution['user_id'] ?? null;
            $userName = $attribution['user_name'] ?? null;
            $userEmail = $attribution['user_email'] ?? null;
            if ($userId && (! $userName || ! $userEmail)) {
                $user = User::where('id', $userId)->first(['name', 'email']);
                $userName = $userName ?? $user?->name;
                $userEmail = $userEmail ?? $user?->email;
            }

            // Extract tokens from Gemini usageMetadata when present
            $promptTokens = 0;
            $candidatesTokens = 0;
            $thoughtsTokens = 0;
            $cachedTokens = 0;
            $totalTokens = 0;

            if ($usageMetadata !== null && is_array($usageMetadata)) {
                $promptTokens = (int) ($usageMetadata['promptTokenCount'] ?? 0);
                $candidatesTokens = (int) ($usageMetadata['candidatesTokenCount'] ?? 0);
                $totalTokens = (int) ($usageMetadata['totalTokenCount'] ?? ($promptTokens + $candidatesTokens));
                $cachedTokens = (int) ($usageMetadata['cachedContentTokenCount'] ?? 0);
                $thoughtsTokens = (int) (
                    $usageMetadata['thoughtsTokenCount']
                    ?? $usageMetadata['candidatesTokensDetails'][0]['thoughtTokenCount']
                    ?? 0
                );
            }

            $sanitizedErrorMessage = $this->sanitizeErrorMessage($errorMessage);

            return DB::transaction(function () use (
                $workspaceId,
                $workspaceName,
                $userId,
                $userName,
                $userEmail,
                $scanType,
                $requestedModel,
                $actualModel,
                $attemptNumber,
                $isFallback,
                $fallbackReason,
                $parentRequestId,
                $imageCount,
                $status,
                $httpStatus,
                $errorCode,
                $sanitizedErrorMessage,
                $startedAt,
                $completedAt,
                $durationMs,
                $promptTokens,
                $candidatesTokens,
                $thoughtsTokens,
                $cachedTokens,
                $totalTokens,
                $usageMetadata,
                $references
            ) {
                $request = AiApiRequest::create([
                    'workspace_id' => $workspaceId,
                    'workspace_name' => $workspaceName,
                    'user_id' => $userId,
                    'user_name' => $userName,
                    'user_email' => $userEmail,
                    'scan_type' => $scanType,
                    'request_uuid' => Str::uuid()->toString(),
                    'idempotency_key' => $references['idempotency_key'] ?? null,
                    'card_scan_id' => $references['card_scan_id'] ?? null,
                    'card_id' => $references['card_id'] ?? null,
                    'bulk_import_id' => $references['bulk_import_id'] ?? null,
                    'bulk_import_item_id' => $references['bulk_import_item_id'] ?? null,
                    'requested_model' => $requestedModel,
                    'actual_model' => $actualModel ?? $requestedModel,
                    'attempt_number' => $attemptNumber,
                    'is_fallback' => $isFallback,
                    'fallback_reason' => $fallbackReason ? Str::limit($fallbackReason, 255) : null,
                    'parent_request_id' => $parentRequestId,
                    'image_count' => max(1, $imageCount),
                    'status' => in_array($status, ['success', 'failed'], true) ? $status : 'pending',
                    'http_status' => $httpStatus,
                    'error_code' => $errorCode,
                    'error_message' => $sanitizedErrorMessage,
                    'started_at' => $startedAt,
                    'completed_at' => $completedAt,
                    'duration_ms' => $durationMs,
                    'prompt_tokens' => $promptTokens,
                    'candidates_tokens' => $candidatesTokens,
                    'thoughts_tokens' => $thoughtsTokens,
                    'cached_tokens' => $cachedTokens,
                    'total_tokens' => $totalTokens,
                    'cost_usd' => 0.000000,
                    'cost_inr' => 0.000000,
                ]);

                // Store normalized exact Gemini usage metadata if returned
                if ($usageMetadata !== null && is_array($usageMetadata)) {
                    AiApiUsageDetail::create([
                        'ai_api_request_id' => $request->id,
                        'prompt_tokens' => $promptTokens,
                        'candidates_tokens' => $candidatesTokens,
                        'thoughts_tokens' => $thoughtsTokens,
                        'cached_content_tokens' => $cachedTokens,
                        'total_tokens' => $totalTokens,
                        'raw_usage_metadata' => $usageMetadata,
                    ]);
                }

                return $request;
            });
        } catch (\Throwable $e) {
            // Safety boundary: Log tracking failure safely, never crash scanning
            Log::error('AI Usage Tracking failure: '.$e->getMessage(), [
                'scan_type' => $scanType,
                'model' => $requestedModel,
                'attempt' => $attemptNumber,
            ]);

            return null;
        }
    }

    /**
     * Classify an error into safe, standardized categories and sanitize messages.
     */
    public function classifyError(?int $httpStatus, ?string $rawError): array
    {
        $rawError = (string) $rawError;

        // 1. Timeout detection
        if (
            str_contains(strtolower($rawError), 'timeout')
            || str_contains(strtolower($rawError), 'timed out')
            || $httpStatus === 504
        ) {
            return [
                'code' => self::ERROR_TIMEOUT,
                'message' => 'Gemini API connection timed out.',
            ];
        }

        // 2. Authentication error
        if (
            $httpStatus === 401
            || $httpStatus === 403
            || str_contains($rawError, 'API_KEY_INVALID')
            || str_contains($rawError, 'PERMISSION_DENIED')
            || str_contains(strtolower($rawError), 'api key')
        ) {
            return [
                'code' => self::ERROR_AUTHENTICATION,
                'message' => 'Gemini authentication failure or invalid API key.',
            ];
        }

        // 3. Rate limiting / Resource Exhaustion
        if (
            $httpStatus === 429
            || str_contains($rawError, 'RESOURCE_EXHAUSTED')
            || str_contains(strtolower($rawError), 'rate limit')
            || str_contains(strtolower($rawError), 'quota')
        ) {
            return [
                'code' => self::ERROR_RATE_LIMIT,
                'message' => 'Gemini API rate limit or quota exceeded.',
            ];
        }

        // 4. Provider server errors
        if (
            in_array($httpStatus, [500, 502, 503], true)
            || str_contains($rawError, 'INTERNAL')
            || str_contains($rawError, 'UNAVAILABLE')
        ) {
            return [
                'code' => self::ERROR_PROVIDER,
                'message' => "Gemini service temporarily unavailable (HTTP {$httpStatus}).",
            ];
        }

        // 5. Network / DNS / SSL errors
        if (
            str_contains(strtolower($rawError), 'curl error')
            || str_contains(strtolower($rawError), 'could not resolve')
            || str_contains(strtolower($rawError), 'connect')
            || str_contains(strtolower($rawError), 'ssl')
        ) {
            return [
                'code' => self::ERROR_NETWORK,
                'message' => 'Network error connecting to Gemini API endpoint.',
            ];
        }

        // 6. Invalid response / JSON parsing errors
        if (
            str_contains(strtolower($rawError), 'json')
            || str_contains(strtolower($rawError), 'no content')
            || str_contains(strtolower($rawError), 'parse')
            || str_contains(strtolower($rawError), 'empty candidate')
        ) {
            return [
                'code' => self::ERROR_INVALID_RESPONSE,
                'message' => 'Gemini response did not contain expected card data schema.',
            ];
        }

        return [
            'code' => self::ERROR_UNKNOWN,
            'message' => $this->sanitizeErrorMessage($rawError) ?: 'Unknown Gemini API extraction failure.',
        ];
    }

    /**
     * Link saved card and scan references to corresponding AI API requests for a single scan.
     */
    public function linkSingleScanEntities(string $idempotencyKey, ?int $cardId = null, ?int $cardScanId = null): void
    {
        try {
            AiApiRequest::where('idempotency_key', $idempotencyKey)->update(array_filter([
                'card_id' => $cardId,
                'card_scan_id' => $cardScanId,
            ], fn ($val) => $val !== null));
        } catch (\Throwable $e) {
            Log::warning('Failed to link AI request to single card entities: '.$e->getMessage());
        }
    }

    /**
     * Link saved card and scan references to corresponding AI API requests for a bulk import item.
     */
    public function linkBulkScanEntities(int $bulkImportItemId, ?int $cardId = null, ?int $cardScanId = null): void
    {
        try {
            AiApiRequest::where('bulk_import_item_id', $bulkImportItemId)->update(array_filter([
                'card_id' => $cardId,
                'card_scan_id' => $cardScanId,
            ], fn ($val) => $val !== null));
        } catch (\Throwable $e) {
            Log::warning('Failed to link AI request to bulk card entities: '.$e->getMessage());
        }
    }

    /**
     * Sanitize error message to ensure no API keys or personal data are persisted.
     */
    public function sanitizeErrorMessage(?string $message): ?string
    {
        if (! $message) {
            return null;
        }

        // Redact query parameter keys: key=AIza...
        $sanitized = preg_replace('/(key=)[A-Za-z0-9_-]+/i', '$1[REDACTED]', $message);

        // Redact header keys: x-goog-api-key: ...
        $sanitized = preg_replace('/(x-goog-api-key:\s*)[^\s]+/i', '$1[REDACTED]', $sanitized);

        // Redact bearer tokens
        $sanitized = preg_replace('/(Bearer\s+)[A-Za-z0-9._-]+/i', '$1[REDACTED]', $sanitized);

        return Str::limit($sanitized, 500);
    }
}
