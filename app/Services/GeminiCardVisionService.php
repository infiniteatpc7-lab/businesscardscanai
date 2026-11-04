<?php

namespace App\Services;

use App\Exceptions\PermanentExtractionException;
use App\Exceptions\TransientGeminiException;
use Illuminate\Support\Facades\Storage;

class GeminiCardVisionService
{
    /**
     * Optional custom cURL handler for testing.
     */
    public static ?\Closure $curlHandler = null;

    public function __construct(
        public ?AiUsageTrackingService $trackingService = null
    ) {
        $this->trackingService = $this->trackingService ?? app(AiUsageTrackingService::class);
    }

    protected string $prompt = <<<'EOT'
You are an expert Multimodal OCR and Business Card Information Extraction engine.
Carefully analyze this business/visiting card image. It may contain text in Gujarati, Hindi, Marathi, Sanskrit, or English.

CRITICAL INSTRUCTIONS FOR REGIONAL & STYLIZED TYPOGRAPHY:
1. Pay extreme attention to stylized, decorative, bold, 3D, curved, or logo fonts (for example stylized Gujarati script like "મોરબી ડેપો"). Do not confuse or misread complex Gujarati vowels, matras, conjuncts, and loop shapes.
2. If text is in an Indian script (Gujarati, Hindi, etc.), provide BOTH the original native script AND the Roman English transliteration/translation.
3. Extract phone numbers accurately (keep 10-digit mobile or STD landline numbers).
4. Extract address completely with street, landmarks, city, state, and 6-digit PIN code if present.
5. Accurately calculate a realistic "accuracy_score" between 0 and 100 based on card image resolution, clarity, font legibility, completeness, and your confidence.
6. Provide an "accuracy_reason" explaining your confidence, font legibility, and which elements were found or absent.

Return ONLY a valid, raw JSON object (strictly adhering to this JSON schema, no markdown wrapping, no backticks, no commentary):
{
  "company": "Company / Shop name in original native script if regional, or English",
  "company_english": "Transliterated company name in English Roman script",
  "name": "Full name of person in original script or English",
  "name_english": "Transliterated person name in English Roman script",
  "designation": "Job title / Designation (e.g. Owner, Partner, Director, Proprietor)",
  "department": "Department if mentioned (e.g. Sales, Export, Production)",
  "phone": ["Array of phone and mobile numbers found"],
  "email": "Primary email address or null",
  "website": "Website URL or null",
  "address": "Full street address with city and PIN code in original script",
  "address_english": "Full street address translated/transliterated in English",
  "tagline_services": "Core business tagline, products manufactured, or services offered",
  "tax_id": "GST number / PAN number / VAT ID if present on card or null",
  "social_profiles": ["Any WhatsApp, Instagram, Facebook, LinkedIn handles or numbers"],
  "detected_language": "Gujarati | Hindi | Marathi | English | Multilingual",
  "accuracy_score": 95,
  "accuracy_reason": "High resolution, clearly printed Gujarati typography and English contact details."
}
EOT;

    public function getModel(): string
    {
        return config('services.gemini.model', 'gemini-3.5-flash');
    }

    public function getApiKey(): string
    {
        $apiKey = config('services.gemini.api_key');
        if (! $apiKey) {
            throw new PermanentExtractionException('Gemini API key is not configured.');
        }

        return $apiKey;
    }

    /**
     * Extract business card text and metadata from image paths using Gemini Vision API.
     *
     * @param  array{
     *     workspace_id?: ?int,
     *     workspace_name?: ?string,
     *     user_id?: ?int,
     *     user_name?: ?string,
     *     user_email?: ?string,
     *     bulk_import_id?: ?int,
     *     bulk_import_item_id?: ?int,
     *     idempotency_key?: ?string,
     *     card_id?: ?int,
     *     card_scan_id?: ?int,
     *     scan_type?: string
     * }  $context
     *
     * @throws TransientGeminiException
     * @throws PermanentExtractionException
     */
    public function extractCardData(string $frontStoragePath, ?string $backStoragePath = null, array $context = []): array
    {
        $disk = Storage::disk('local');
        if (! $disk->exists($frontStoragePath)) {
            throw new PermanentExtractionException("Front card image not found at path: {$frontStoragePath}");
        }

        $rawBytes = $disk->get($frontStoragePath);
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_buffer($finfo, $rawBytes) ?: 'image/jpeg';

        $base64Data = base64_encode($rawBytes);
        $apiKey = $this->getApiKey();

        $modelsToTry = array_values(array_unique(array_filter([
            $this->getModel(),
            ...config('services.gemini.models', [
                'gemini-3.5-flash',
                'gemini-3.5-flash-lite',
                'gemini-flash-lite-latest',
                'gemini-3.8-flash',
                'gemini-2.5-flash',
            ]),
        ])));

        $parts = [
            ['text' => $this->prompt],
            [
                'inline_data' => [
                    'mime_type' => $mimeType,
                    'data' => $base64Data,
                ],
            ],
        ];

        $imageCount = 1;
        // If back image exists, include as second image part
        if ($backStoragePath && $disk->exists($backStoragePath)) {
            $imageCount = 2;
            $backBytes = $disk->get($backStoragePath);
            $finfoBack = finfo_open(FILEINFO_MIME_TYPE);
            $backMime = finfo_buffer($finfoBack, $backBytes) ?: 'image/jpeg';

            $parts[] = [
                'inline_data' => [
                    'mime_type' => $backMime,
                    'data' => base64_encode($backBytes),
                ],
            ];
        }

        $payload = [
            'contents' => [
                ['parts' => $parts],
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'application/json',
            ],
        ];

        $jsonPayload = json_encode($payload);
        $lastException = null;
        $attemptNumber = 0;
        $firstRequestId = null;
        $previousModel = null;
        $previousError = null;

        foreach ($modelsToTry as $model) {
            $attemptNumber++;
            $isFallback = ($attemptNumber > 1);
            $fallbackReason = $isFallback ? "Fallback from {$previousModel}: {$previousError}" : null;

            $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

            $startTime = hrtime(true);
            $startedAt = now();

            if (static::$curlHandler !== null) {
                $curlResult = (static::$curlHandler)($endpoint, $jsonPayload, $apiKey, $model);
                $rawResponse = $curlResult['response'] ?? null;
                $httpCode = $curlResult['http_code'] ?? 200;
                $curlError = $curlResult['error'] ?? null;
            } else {
                $ch = curl_init($endpoint);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_HTTPHEADER => [
                        'Content-Type: application/json',
                        'Content-Length: '.strlen($jsonPayload),
                        'x-goog-api-key: '.$apiKey,
                    ],
                    CURLOPT_POSTFIELDS => $jsonPayload,
                    CURLOPT_TIMEOUT => 45,
                    CURLOPT_CONNECTTIMEOUT => 15,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                ]);

                $rawResponse = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);
            }

            $completedAt = now();
            $durationMs = (int) round((hrtime(true) - $startTime) / 1e6);

            if ($curlError) {
                $classified = $this->trackingService->classifyError(null, $curlError);
                $recorded = $this->trackingService->recordAttempt(
                    scanType: $context['scan_type'] ?? 'bulk_scan',
                    requestedModel: $model,
                    actualModel: $model,
                    attemptNumber: $attemptNumber,
                    isFallback: $isFallback,
                    fallbackReason: $fallbackReason,
                    parentRequestId: $firstRequestId,
                    imageCount: $imageCount,
                    status: 'failed',
                    httpStatus: $httpCode ?: null,
                    errorCode: $classified['code'],
                    errorMessage: $classified['message'],
                    startedAt: $startedAt,
                    completedAt: $completedAt,
                    durationMs: $durationMs,
                    usageMetadata: null,
                    attribution: [
                        'workspace_id' => $context['workspace_id'] ?? null,
                        'workspace_name' => $context['workspace_name'] ?? null,
                        'user_id' => $context['user_id'] ?? null,
                        'user_name' => $context['user_name'] ?? null,
                        'user_email' => $context['user_email'] ?? null,
                    ],
                    references: [
                        'bulk_import_id' => $context['bulk_import_id'] ?? null,
                        'bulk_import_item_id' => $context['bulk_import_item_id'] ?? null,
                        'idempotency_key' => $context['idempotency_key'] ?? null,
                        'card_id' => $context['card_id'] ?? null,
                        'card_scan_id' => $context['card_scan_id'] ?? null,
                    ]
                );

                if ($attemptNumber === 1 && $recorded) {
                    $firstRequestId = $recorded->id;
                }

                $previousModel = $model;
                $previousError = $classified['message'];
                $lastException = new TransientGeminiException("Network cURL error on model {$model}: {$curlError}");

                continue;
            }

            // Handle HTTP Status classifications (Rate limits or server spikes: try next fallback model)
            if (in_array($httpCode, [429, 500, 502, 503, 504], true)) {
                $classified = $this->trackingService->classifyError($httpCode, $rawResponse);
                $decodedErr = is_string($rawResponse) ? json_decode($rawResponse, true) : null;
                $usageMeta = is_array($decodedErr) ? ($decodedErr['usageMetadata'] ?? null) : null;

                $recorded = $this->trackingService->recordAttempt(
                    scanType: $context['scan_type'] ?? 'bulk_scan',
                    requestedModel: $model,
                    actualModel: $model,
                    attemptNumber: $attemptNumber,
                    isFallback: $isFallback,
                    fallbackReason: $fallbackReason,
                    parentRequestId: $firstRequestId,
                    imageCount: $imageCount,
                    status: 'failed',
                    httpStatus: $httpCode,
                    errorCode: $classified['code'],
                    errorMessage: $classified['message'],
                    startedAt: $startedAt,
                    completedAt: $completedAt,
                    durationMs: $durationMs,
                    usageMetadata: $usageMeta,
                    attribution: [
                        'workspace_id' => $context['workspace_id'] ?? null,
                        'workspace_name' => $context['workspace_name'] ?? null,
                        'user_id' => $context['user_id'] ?? null,
                        'user_name' => $context['user_name'] ?? null,
                        'user_email' => $context['user_email'] ?? null,
                    ],
                    references: [
                        'bulk_import_id' => $context['bulk_import_id'] ?? null,
                        'bulk_import_item_id' => $context['bulk_import_item_id'] ?? null,
                        'idempotency_key' => $context['idempotency_key'] ?? null,
                        'card_id' => $context['card_id'] ?? null,
                        'card_scan_id' => $context['card_scan_id'] ?? null,
                    ]
                );

                if ($attemptNumber === 1 && $recorded) {
                    $firstRequestId = $recorded->id;
                }

                $previousModel = $model;
                $previousError = $classified['message'];
                $lastException = new TransientGeminiException("Gemini transient HTTP {$httpCode} on model {$model}: {$rawResponse}");

                continue;
            }

            if ($httpCode !== 200) {
                $decodedErr = is_string($rawResponse) ? json_decode($rawResponse, true) : null;
                $msg = is_array($decodedErr) ? ($decodedErr['error']['message'] ?? $rawResponse) : (string) $rawResponse;
                $classified = $this->trackingService->classifyError($httpCode, $msg);
                $usageMeta = is_array($decodedErr) ? ($decodedErr['usageMetadata'] ?? null) : null;

                $recorded = $this->trackingService->recordAttempt(
                    scanType: $context['scan_type'] ?? 'bulk_scan',
                    requestedModel: $model,
                    actualModel: $model,
                    attemptNumber: $attemptNumber,
                    isFallback: $isFallback,
                    fallbackReason: $fallbackReason,
                    parentRequestId: $firstRequestId,
                    imageCount: $imageCount,
                    status: 'failed',
                    httpStatus: $httpCode,
                    errorCode: $classified['code'],
                    errorMessage: $classified['message'],
                    startedAt: $startedAt,
                    completedAt: $completedAt,
                    durationMs: $durationMs,
                    usageMetadata: $usageMeta,
                    attribution: [
                        'workspace_id' => $context['workspace_id'] ?? null,
                        'workspace_name' => $context['workspace_name'] ?? null,
                        'user_id' => $context['user_id'] ?? null,
                        'user_name' => $context['user_name'] ?? null,
                        'user_email' => $context['user_email'] ?? null,
                    ],
                    references: [
                        'bulk_import_id' => $context['bulk_import_id'] ?? null,
                        'bulk_import_item_id' => $context['bulk_import_item_id'] ?? null,
                        'idempotency_key' => $context['idempotency_key'] ?? null,
                        'card_id' => $context['card_id'] ?? null,
                        'card_scan_id' => $context['card_scan_id'] ?? null,
                    ]
                );

                if ($attemptNumber === 1 && $recorded) {
                    $firstRequestId = $recorded->id;
                }

                $previousModel = $model;
                $previousError = $classified['message'];
                $lastException = new PermanentExtractionException("Gemini permanent HTTP {$httpCode} on model {$model}: {$msg}");

                continue;
            }

            $json = is_string($rawResponse) ? json_decode($rawResponse, true) : null;
            $usageMetadata = is_array($json) ? ($json['usageMetadata'] ?? null) : null;
            $text = is_array($json) ? ($json['candidates'][0]['content']['parts'][0]['text'] ?? null) : null;

            if (! $text) {
                $classified = $this->trackingService->classifyError(200, 'Gemini returned empty candidate content');
                $recorded = $this->trackingService->recordAttempt(
                    scanType: $context['scan_type'] ?? 'bulk_scan',
                    requestedModel: $model,
                    actualModel: $model,
                    attemptNumber: $attemptNumber,
                    isFallback: $isFallback,
                    fallbackReason: $fallbackReason,
                    parentRequestId: $firstRequestId,
                    imageCount: $imageCount,
                    status: 'failed',
                    httpStatus: 200,
                    errorCode: $classified['code'],
                    errorMessage: $classified['message'],
                    startedAt: $startedAt,
                    completedAt: $completedAt,
                    durationMs: $durationMs,
                    usageMetadata: $usageMetadata,
                    attribution: [
                        'workspace_id' => $context['workspace_id'] ?? null,
                        'workspace_name' => $context['workspace_name'] ?? null,
                        'user_id' => $context['user_id'] ?? null,
                        'user_name' => $context['user_name'] ?? null,
                        'user_email' => $context['user_email'] ?? null,
                    ],
                    references: [
                        'bulk_import_id' => $context['bulk_import_id'] ?? null,
                        'bulk_import_item_id' => $context['bulk_import_item_id'] ?? null,
                        'idempotency_key' => $context['idempotency_key'] ?? null,
                        'card_id' => $context['card_id'] ?? null,
                        'card_scan_id' => $context['card_scan_id'] ?? null,
                    ]
                );

                if ($attemptNumber === 1 && $recorded) {
                    $firstRequestId = $recorded->id;
                }

                $previousModel = $model;
                $previousError = $classified['message'];
                $lastException = new PermanentExtractionException("Gemini returned empty candidate content on model {$model}.");

                continue;
            }

            $cleanText = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
            $cleanText = preg_replace('/\s*```$/i', '', $cleanText);
            $parsed = json_decode($cleanText, true);

            if (! is_array($parsed)) {
                $classified = $this->trackingService->classifyError(200, 'Unable to parse JSON from Gemini response');
                $recorded = $this->trackingService->recordAttempt(
                    scanType: $context['scan_type'] ?? 'bulk_scan',
                    requestedModel: $model,
                    actualModel: $model,
                    attemptNumber: $attemptNumber,
                    isFallback: $isFallback,
                    fallbackReason: $fallbackReason,
                    parentRequestId: $firstRequestId,
                    imageCount: $imageCount,
                    status: 'failed',
                    httpStatus: 200,
                    errorCode: $classified['code'],
                    errorMessage: $classified['message'],
                    startedAt: $startedAt,
                    completedAt: $completedAt,
                    durationMs: $durationMs,
                    usageMetadata: $usageMetadata,
                    attribution: [
                        'workspace_id' => $context['workspace_id'] ?? null,
                        'workspace_name' => $context['workspace_name'] ?? null,
                        'user_id' => $context['user_id'] ?? null,
                        'user_name' => $context['user_name'] ?? null,
                        'user_email' => $context['user_email'] ?? null,
                    ],
                    references: [
                        'bulk_import_id' => $context['bulk_import_id'] ?? null,
                        'bulk_import_item_id' => $context['bulk_import_item_id'] ?? null,
                        'idempotency_key' => $context['idempotency_key'] ?? null,
                        'card_id' => $context['card_id'] ?? null,
                        'card_scan_id' => $context['card_scan_id'] ?? null,
                    ]
                );

                if ($attemptNumber === 1 && $recorded) {
                    $firstRequestId = $recorded->id;
                }

                $previousModel = $model;
                $previousError = $classified['message'];
                $lastException = new PermanentExtractionException("Unable to parse JSON from Gemini response on model {$model}: ".substr($cleanText, 0, 100));

                continue;
            }

            // Successfully parsed card data from Gemini
            $this->trackingService->recordAttempt(
                scanType: $context['scan_type'] ?? 'bulk_scan',
                requestedModel: $model,
                actualModel: $model,
                attemptNumber: $attemptNumber,
                isFallback: $isFallback,
                fallbackReason: $fallbackReason,
                parentRequestId: $firstRequestId,
                imageCount: $imageCount,
                status: 'success',
                httpStatus: 200,
                errorCode: null,
                errorMessage: null,
                startedAt: $startedAt,
                completedAt: $completedAt,
                durationMs: $durationMs,
                usageMetadata: $usageMetadata,
                attribution: [
                    'workspace_id' => $context['workspace_id'] ?? null,
                    'workspace_name' => $context['workspace_name'] ?? null,
                    'user_id' => $context['user_id'] ?? null,
                    'user_name' => $context['user_name'] ?? null,
                    'user_email' => $context['user_email'] ?? null,
                ],
                references: [
                    'bulk_import_id' => $context['bulk_import_id'] ?? null,
                    'bulk_import_item_id' => $context['bulk_import_item_id'] ?? null,
                    'idempotency_key' => $context['idempotency_key'] ?? null,
                    'card_id' => $context['card_id'] ?? null,
                    'card_scan_id' => $context['card_scan_id'] ?? null,
                ]
            );

            return $parsed;
        }

        throw $lastException ?? new TransientGeminiException('Gemini extraction failed across all configured models.');
    }
}
