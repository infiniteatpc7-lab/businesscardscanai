<?php

namespace App\Http\Controllers;

use App\Exceptions\QuotaExceededException;
use App\Models\Card;
use App\Models\CardScan;
use App\Models\Exhibition;
use App\Models\UserSelectedExhibition;
use App\Models\Workspace;
use App\Services\CardDuplicateDetector;
use App\Services\CardImageService;
use App\Services\ScanQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class CardController extends Controller
{
    public function __construct()
    {
        // Ensure system temp directory is set to a writable project path on Windows
        $tempDir = storage_path('framework/cache');
        if (! is_dir($tempDir)) {
            @mkdir($tempDir, 0777, true);
        }
        putenv("TMP={$tempDir}");
        putenv("TEMP={$tempDir}");
        @ini_set('sys_temp_dir', $tempDir);
    }

    /**
     * Display a listing of saved cards scoped to the authenticated user's workspace.
     * Supports role-based member visibility, team member filter for Owner/Admin,
     * optional exhibition filtering via ?exhibition_id=, and date range filtering.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        $query = Card::query()
            ->forWorkspace($workspace->id)
            ->latest();

        // Enforce role-based card visibility
        if ($role === 'member') {
            // A Member can see only contacts/cards they personally scanned (or legacy created without scans)
            $query->where(function ($q) use ($user, $workspace) {
                $q->whereHas('scans', function ($sq) use ($user, $workspace) {
                    $sq->where('workspace_id', $workspace->id)
                        ->where('user_id', $user->id);
                })->orWhere(function ($oq) use ($user) {
                    $oq->where('user_id', $user->id)->doesntHave('scans');
                });
            });

            $query->with([
                'exhibitions:id,name,status',
                'scans' => function ($sq) use ($user, $workspace) {
                    $sq->where('workspace_id', $workspace->id)
                        ->where('user_id', $user->id)
                        ->with(['user:id,name', 'exhibition:id,name']);
                },
            ]);
        } else {
            // Owner and Admin can view all workspace cards and optionally filter by team member
            if ($memberId = $request->input('member_id')) {
                $memberId = (int) $memberId;
                $query->where(function ($q) use ($memberId, $workspace) {
                    $q->whereHas('scans', function ($sq) use ($memberId, $workspace) {
                        $sq->where('workspace_id', $workspace->id)
                            ->where('user_id', $memberId);
                    })->orWhere(function ($oq) use ($memberId) {
                        $oq->where('user_id', $memberId)->doesntHave('scans');
                    });
                });
            }

            $query->with([
                'exhibitions:id,name,status',
                'scans.user:id,name',
                'scans.exhibition:id,name',
                'user:id,name',
            ]);
        }

        if ($exhibitionId = $request->input('exhibition_id')) {
            $query->whereHas('exhibitions', function ($q) use ($exhibitionId) {
                $q->where('exhibitions.id', $exhibitionId);
            });
        }

        if ($fromDate = $request->input('from_date')) {
            $query->whereDate('created_at', '>=', $fromDate);
        }

        if ($toDate = $request->input('to_date')) {
            $query->whereDate('created_at', '<=', $toDate);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('company', 'like', "%{$search}%")
                    ->orWhere('company_english', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('name_english', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $cards = $query->get()->map(function (Card $card) use ($role) {
            if ($role === 'member') {
                $memberScan = $card->scans->first();
                if ($memberScan && $memberScan->front_image_path) {
                    $card->image_path = $memberScan->front_image_path;
                }
                if ($memberScan && $memberScan->back_image_path) {
                    $card->back_image_path = $memberScan->back_image_path;
                }
                // Members do not receive other members' attribution
                $card->setAttribute('scanners', []);
            } else {
                $creatorScanner = $card->user ? ['id' => $card->user->id, 'name' => $card->user->name] : null;

                $scanners = $card->scans
                    ->filter(fn ($scan) => $scan->user !== null)
                    ->map(fn ($scan) => [
                        'id' => $scan->user->id,
                        'name' => $scan->user->name,
                    ]);

                if ($creatorScanner) {
                    $scanners = $scanners->prepend($creatorScanner);
                }

                $scanners = $scanners->unique('id')->values();

                $card->setAttribute('scanners', $scanners);
            }

            return $card;
        });

        return response()->json([
            'success' => true,
            'cards' => $cards,
        ]);
    }

    /**
     * Scan an uploaded card image using Gemini Multimodal Vision API.
     * Uses private storage, strict image validation, and secure header authentication.
     */
    public function scan(Request $request, ScanQuotaService $quotaService): JsonResponse
    {
        $validatedImage = $this->validateAndExtractImage($request);

        if (! $validatedImage['success']) {
            return response()->json([
                'success' => false,
                'message' => $validatedImage['error'],
            ], $validatedImage['status'] ?? 422);
        }

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $scanIdempotencyKey = $request->header('X-Idempotency-Key')
            ?? $request->input('scan_idempotency_key')
            ?? ('scan_'.Str::uuid());

        $storedPath = $validatedImage['storage_path'];

        // Reserve scan quota before initiating billable Gemini multimodal extraction
        try {
            $quotaService->reserveQuota($workspace, $user, 'single_scan', $scanIdempotencyKey);
        } catch (QuotaExceededException $qe) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }

            return $qe->render($request);
        }

        $apiKey = config('services.gemini.api_key');
        if (! $apiKey) {
            $quotaService->releaseReservation($scanIdempotencyKey, 'gemini_api_key_missing');

            // Clean up stored image on configuration error
            if (! empty($validatedImage['storage_path'])) {
                Storage::disk('local')->delete($validatedImage['storage_path']);
            }

            Log::error('OCR vision service configuration error: services.gemini.api_key is not configured.');

            return response()->json([
                'success' => false,
                'message' => 'The business card scanning service is currently unavailable. Please try again later.',
            ], 503);
        }

        $rawBytes = $validatedImage['raw_bytes'];
        $mimeType = $validatedImage['mime_type'];

        // Optimize image resolution if too large for OCR (e.g. mobile photos > 1800px)
        $optimized = $this->optimizeImageBytes($rawBytes, $mimeType);
        $base64Data = base64_encode($optimized['bytes']);
        $mimeType = $optimized['mime'];

        // Specialized Multimodal OCR prompt for Indian Regional typography & English
        $prompt = <<<'EOT'
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

        $preferredModel = config('services.gemini.model', 'gemini-2.5-flash');
        $modelsToTry = array_values(array_unique(array_filter([
            $preferredModel,
            ...config('services.gemini.models', ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash']),
        ])));

        $geminiResult = null;
        $lastError = null;

        foreach ($modelsToTry as $modelName) {
            $geminiResult = $this->callGeminiApiCurl($apiKey, $modelName, $prompt, $mimeType, $base64Data);
            if ($geminiResult['success']) {
                break;
            }
            $lastError = $geminiResult['error'] ?? 'Unknown error';
        }

        $storedBackPath = null;
        if ($request->hasFile('back_image') || $request->filled('back_image_base64')) {
            $validatedBack = $this->validateAndExtractImage($request, 'back_image', 'back_image_base64');
            if ($validatedBack['success'] && ! empty($validatedBack['storage_path'])) {
                $storedBackPath = $validatedBack['storage_path'];
            }
        }

        if (! $geminiResult || ! $geminiResult['success']) {
            // Release held quota reservation upon extraction failure
            $quotaService->releaseReservation($scanIdempotencyKey, 'gemini_extraction_failure');

            // Clean up stored images upon failed scan
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }
            if ($storedBackPath) {
                Storage::disk('local')->delete($storedBackPath);
            }

            Log::error('Gemini Card Vision API processing failure', [
                'error' => $lastError,
                'models_attempted' => $modelsToTry,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to extract business card details. Please ensure the card is clear, well-lit, and try again.',
            ], 502);
        }

        $extractedData = $geminiResult['data'];
        $extractedData['image_path'] = $storedPath;
        $extractedData['scan_idempotency_key'] = $scanIdempotencyKey;
        if ($storedBackPath) {
            $extractedData['back_image_path'] = $storedBackPath;
        }

        return response()->json([
            'success' => true,
            'data' => $extractedData,
        ]);
    }

    /**
     * Upload a standalone card image (e.g. back of card or replacement image).
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $validatedImage = $this->validateAndExtractImage($request, 'image', 'image_base64');

        if (! $validatedImage['success']) {
            return response()->json([
                'success' => false,
                'message' => $validatedImage['error'],
            ], $validatedImage['status'] ?? 422);
        }

        return response()->json([
            'success' => true,
            'image_path' => $validatedImage['storage_path'],
        ]);
    }

    /**
     * Direct cURL call to Gemini REST API using secure header authentication (x-goog-api-key)
     * and SSL certificate verification.
     */
    private function callGeminiApiCurl(string $apiKey, string $model, string $prompt, string $mimeType, string $base64Data): array
    {
        $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mimeType,
                                'data' => $base64Data,
                            ],
                        ],
                    ],
                ],
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'application/json',
            ],
        ];

        $jsonPayload = json_encode($payload);

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

        if ($curlError) {
            return [
                'success' => false,
                'error' => "Network cURL error: {$curlError}",
            ];
        }

        if ($httpCode !== 200) {
            $decodedErr = json_decode($rawResponse, true);
            $msg = $decodedErr['error']['message'] ?? $rawResponse;

            return [
                'success' => false,
                'error' => "Gemini HTTP {$httpCode}: {$msg}",
            ];
        }

        $json = json_decode($rawResponse, true);
        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! $text) {
            return [
                'success' => false,
                'error' => 'No content returned from Gemini model.',
            ];
        }

        $cleanText = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
        $cleanText = preg_replace('/\s*```$/i', '', $cleanText);
        $parsed = json_decode($cleanText, true);

        if (! is_array($parsed)) {
            return [
                'success' => false,
                'error' => 'Unable to parse JSON from Gemini response: '.substr($cleanText, 0, 100),
            ];
        }

        return [
            'success' => true,
            'data' => $parsed,
        ];
    }

    /**
     * Strictly validate image payload, MIME type, dimensions, and save to private storage.
     * Delegates validation to CardImageService for unified support of JPG, PNG, WebP, HEIC, AVIF, BMP, TIFF.
     */
    private function validateAndExtractImage(Request $request, string $fileKey = 'image', string $base64Key = 'image_base64'): array
    {
        $validated = app(CardImageService::class)->validateAndExtractImage($request, $fileKey, $base64Key);
        if (! $validated['success']) {
            return $validated;
        }

        // Save safely into private storage (storage/app/private/cards)
        $relativePath = 'cards/'.Str::uuid().'.'.$validated['extension'];
        Storage::disk('local')->put($relativePath, $validated['raw_bytes']);

        return [
            'success' => true,
            'raw_bytes' => $validated['raw_bytes'],
            'mime_type' => $validated['mime_type'],
            'storage_path' => $relativePath,
        ];
    }

    /**
     * Downscale high-resolution phone camera images to optimum OCR size (max 1800px).
     */
    private function optimizeImageBytes(string $bytes, string $mime): array
    {
        if (! extension_loaded('gd') || strlen($bytes) < 1024 * 1024) {
            return ['bytes' => $bytes, 'mime' => $mime];
        }

        $srcImg = @imagecreatefromstring($bytes);
        if (! $srcImg) {
            return ['bytes' => $bytes, 'mime' => $mime];
        }

        $origW = imagesx($srcImg);
        $origH = imagesy($srcImg);
        $maxDim = 1800;

        if ($origW <= $maxDim && $origH <= $maxDim) {
            imagedestroy($srcImg);

            return ['bytes' => $bytes, 'mime' => $mime];
        }

        if ($origW > $origH) {
            $newW = $maxDim;
            $newH = (int) round(($origH / $origW) * $maxDim);
        } else {
            $newH = $maxDim;
            $newW = (int) round(($origW / $origH) * $maxDim);
        }

        $dstImg = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newW, $newH, $origW, $origH);

        ob_start();
        imagejpeg($dstImg, null, 88);
        $compressedBytes = ob_get_clean();

        imagedestroy($srcImg);
        imagedestroy($dstImg);

        return [
            'bytes' => $compressedBytes ?: $bytes,
            'mime' => 'image/jpeg',
        ];
    }

    /**
     * Store a scanned or edited card in the database with workspace-scoped duplicate detection,
     * atomic exhibition association, and individual scan history tracking.
     */
    public function store(Request $request, CardDuplicateDetector $duplicateDetector, ScanQuotaService $quotaService): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $validated = $request->validate([
            'company' => 'nullable|string|max:255',
            'company_english' => 'nullable|string|max:255',
            'name' => 'nullable|string|max:255',
            'name_english' => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'phone' => 'nullable|array',
            'email' => 'nullable|string|max:255',
            'website' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'address_english' => 'nullable|string',
            'tagline_services' => 'nullable|string',
            'tax_id' => 'nullable|string|max:100',
            'social_profiles' => 'nullable|array',
            'accuracy_score' => 'nullable|integer|min:0|max:100',
            'accuracy_reason' => 'nullable|string',
            'detected_language' => 'nullable|string|max:100',
            'image_path' => 'nullable|string|max:500',
            'back_image_path' => 'nullable|string|max:500',
            'raw_data' => 'nullable|array',
            'force_duplicate' => 'nullable|boolean',
            'exhibition_id' => 'nullable|integer',
            'link_existing_card_id' => 'nullable|integer',
            'scan_notes' => 'nullable|string|max:1000',
            'scan_idempotency_key' => 'nullable|string|max:128',
        ]);

        // Resolve active target exhibition
        $exhibition = $this->resolveTargetExhibition($validated['exhibition_id'] ?? null, $workspace, $user->id);

        // Case 1: Linking an existing canonical contact to this exhibition with a new scan event
        if (! empty($validated['link_existing_card_id'])) {
            $existingCard = Card::forWorkspace($workspace->id)->find($validated['link_existing_card_id']);
            if (! $existingCard) {
                return response()->json([
                    'success' => false,
                    'message' => 'Specified contact card not found in this workspace.',
                ], 404);
            }

            $scanKey = $validated['scan_idempotency_key']
                ?? $request->header('X-Idempotency-Key')
                ?? ('link_scan_'.Str::uuid());

            try {
                DB::transaction(function () use ($existingCard, $exhibition, $workspace, $user, $validated, $quotaService, $scanKey) {
                    // Associate with exhibition
                    $existingCard->exhibitions()->syncWithoutDetaching([
                        $exhibition->id => ['created_at' => now()],
                    ]);

                    // Record fresh scan history
                    $scan = CardScan::create([
                        'workspace_id' => $workspace->id,
                        'card_id' => $existingCard->id,
                        'exhibition_id' => $exhibition->id,
                        'user_id' => $user->id,
                        'scanned_at' => now(),
                        'front_image_path' => $validated['image_path'] ?? $existingCard->image_path,
                        'back_image_path' => $validated['back_image_path'] ?? $existingCard->back_image_path,
                        'accuracy_score' => $validated['accuracy_score'] ?? 90,
                        'notes' => $validated['scan_notes'] ?? null,
                    ]);

                    // Deduct or confirm scan credit for linking contact to new exhibition event
                    $quotaService->recordSuccessfulScan(
                        $workspace,
                        $user,
                        'link_existing_contact',
                        $scanKey,
                        $existingCard->id,
                        $scan->id
                    );
                });
            } catch (QuotaExceededException $qe) {
                return $qe->render($request);
            }

            $role = $request->attributes->get('workspace_role');
            if ($role === 'member') {
                $existingCard->load([
                    'exhibitions',
                    'scans' => function ($sq) use ($user, $workspace) {
                        $sq->where('workspace_id', $workspace->id)
                            ->where('user_id', $user->id)
                            ->with(['user:id,name', 'exhibition:id,name']);
                    },
                ]);
                $existingCard->setAttribute('scanners', []);
            } else {
                $existingCard->load(['exhibitions', 'scans.user:id,name', 'scans.exhibition:id,name', 'user:id,name']);
                $scanners = $existingCard->scans
                    ->filter(fn ($scan) => $scan->user !== null)
                    ->map(fn ($scan) => [
                        'id' => $scan->user->id,
                        'name' => $scan->user->name,
                    ])
                    ->unique('id')
                    ->values();
                if ($scanners->isEmpty() && $existingCard->user) {
                    $scanners = collect([[
                        'id' => $existingCard->user->id,
                        'name' => $existingCard->user->name,
                    ]]);
                }
                $existingCard->setAttribute('scanners', $scanners);
            }

            return response()->json([
                'success' => true,
                'linked' => true,
                'message' => "Contact successfully linked to {$exhibition->name} with scan event recorded.",
                'card' => $existingCard,
            ], 200);
        }

        $forceDuplicate = filter_var($request->input('force_duplicate', false), FILTER_VALIDATE_BOOLEAN);

        // Run duplicate detection strictly against cards in current workspace
        $duplicateResult = $duplicateDetector->detectDuplicates($validated, $workspace->id);

        if ($duplicateResult['has_duplicates']) {
            if (! $forceDuplicate) {
                $matchingCardIds = collect($duplicateResult['matching_cards'])->pluck('id');
                $alreadyInThisExhibition = DB::table('card_exhibitions')
                    ->where('exhibition_id', $exhibition->id)
                    ->whereIn('card_id', $matchingCardIds)
                    ->exists();

                $reasonText = match ($duplicateResult['primary_reason']) {
                    'phone' => 'A contact with this phone number is already saved in your directory.',
                    'email' => 'A contact with this email address is already saved in your directory.',
                    'name_company' => 'A card with this contact name and company already exists in your directory.',
                    default => 'A potential matching card already exists in your directory.',
                };

                return response()->json([
                    'success' => false,
                    'duplicate' => true,
                    'already_in_exhibition' => $alreadyInThisExhibition,
                    'target_exhibition' => [
                        'id' => $exhibition->id,
                        'name' => $exhibition->name,
                    ],
                    'message' => $alreadyInThisExhibition
                        ? $reasonText." (Already recorded at {$exhibition->name})"
                        : $reasonText." You can link this existing contact to {$exhibition->name} or save as a separate card.",
                    'match_reason' => $duplicateResult['primary_reason'],
                    'existing_cards' => $duplicateResult['matching_cards'],
                ], 409);
            }

            Log::info('Duplicate card save forced by user override', [
                'workspace_id' => $workspace->id,
                'name' => $validated['name'] ?? null,
                'company' => $validated['company'] ?? null,
                'match_count' => count($duplicateResult['matching_cards']),
            ]);
        }

        $scanKey = $validated['scan_idempotency_key']
            ?? $request->header('X-Idempotency-Key')
            ?? ('card_scan_'.Str::uuid());

        try {
            // Case 2: Save new card + associate with exhibition + record scan event inside atomic transaction
            $card = DB::transaction(function () use ($validated, $workspace, $user, $exhibition, $quotaService, $scanKey) {
                $cardData = $validated;
                unset(
                    $cardData['force_duplicate'],
                    $cardData['exhibition_id'],
                    $cardData['link_existing_card_id'],
                    $cardData['scan_notes'],
                    $cardData['scan_idempotency_key']
                );

                $cardData['workspace_id'] = $workspace->id;
                $cardData['user_id'] = $user->id;

                $newCard = Card::create($cardData);

                // Associate with exhibition
                $newCard->exhibitions()->syncWithoutDetaching([
                    $exhibition->id => ['created_at' => now()],
                ]);

                // Record atomic scan history
                $scan = CardScan::create([
                    'workspace_id' => $workspace->id,
                    'card_id' => $newCard->id,
                    'exhibition_id' => $exhibition->id,
                    'user_id' => $user->id,
                    'scanned_at' => now(),
                    'front_image_path' => $cardData['image_path'] ?? null,
                    'back_image_path' => $cardData['back_image_path'] ?? null,
                    'accuracy_score' => $cardData['accuracy_score'] ?? 90,
                    'notes' => $validated['scan_notes'] ?? null,
                ]);

                // Deduct or confirm scan credit atomically
                $quotaService->recordSuccessfulScan(
                    $workspace,
                    $user,
                    'single_scan',
                    $scanKey,
                    $newCard->id,
                    $scan->id
                );

                return $newCard;
            });
        } catch (QuotaExceededException $qe) {
            return $qe->render($request);
        }

        $role = $request->attributes->get('workspace_role');
        if ($role === 'member') {
            $card->load([
                'exhibitions',
                'scans' => function ($sq) use ($user, $workspace) {
                    $sq->where('workspace_id', $workspace->id)
                        ->where('user_id', $user->id)
                        ->with(['user:id,name', 'exhibition:id,name']);
                },
            ]);
            $card->setAttribute('scanners', []);
        } else {
            $card->load(['exhibitions', 'scans.user:id,name', 'scans.exhibition:id,name', 'user:id,name']);
            $scanners = $card->scans
                ->filter(fn ($scan) => $scan->user !== null)
                ->map(fn ($scan) => [
                    'id' => $scan->user->id,
                    'name' => $scan->user->name,
                ])
                ->unique('id')
                ->values();
            if ($scanners->isEmpty() && $card->user) {
                $scanners = collect([[
                    'id' => $card->user->id,
                    'name' => $card->user->name,
                ]]);
            }
            $card->setAttribute('scanners', $scanners);
        }

        return response()->json([
            'success' => true,
            'message' => 'Card saved successfully to database!',
            'card' => $card,
            'duplicate_override' => $forceDuplicate && $duplicateResult['has_duplicates'],
        ], 201);
    }

    /**
     * Display the specified card scoped to the user's workspace with exhibitions and scan history.
     * Enforces member-level visibility isolation (IDOR protection).
     */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found',
            ], 404);
        }

        if ($role === 'member') {
            $hasScan = $card->scans()->where('workspace_id', $workspace->id)->where('user_id', $user->id)->exists();
            $isLegacyCreator = ($card->user_id === $user->id && $card->scans()->count() === 0);

            if (! $hasScan && ! $isLegacyCreator) {
                return response()->json([
                    'success' => false,
                    'message' => 'Card not found',
                ], 404);
            }

            $card->load([
                'exhibitions',
                'scans' => function ($sq) use ($user, $workspace) {
                    $sq->where('workspace_id', $workspace->id)
                        ->where('user_id', $user->id)
                        ->with(['user:id,name', 'exhibition:id,name']);
                },
            ]);

            $memberScan = $card->scans->first();
            if ($memberScan && $memberScan->front_image_path) {
                $card->image_path = $memberScan->front_image_path;
            }
            if ($memberScan && $memberScan->back_image_path) {
                $card->back_image_path = $memberScan->back_image_path;
            }
            $card->setAttribute('scanners', []);
        } else {
            $card->load(['exhibitions', 'scans.user:id,name', 'scans.exhibition:id,name', 'user:id,name']);

            $scanners = $card->scans
                ->filter(fn ($scan) => $scan->user !== null)
                ->map(fn ($scan) => [
                    'id' => $scan->user->id,
                    'name' => $scan->user->name,
                ])
                ->unique('id')
                ->values();

            if ($scanners->isEmpty() && $card->user) {
                $scanners = collect([[
                    'id' => $card->user->id,
                    'name' => $card->user->name,
                ]]);
            }

            $card->setAttribute('scanners', $scanners);
        }

        return response()->json([
            'success' => true,
            'card' => $card,
        ]);
    }

    /**
     * Update the specified card scoped to the user's workspace.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found',
            ], 404);
        }

        if ($role === 'member') {
            $hasScan = $card->scans()->where('workspace_id', $workspace->id)->where('user_id', $user->id)->exists();
            $isLegacyCreator = ($card->user_id === $user->id && $card->scans()->count() === 0);

            if (! $hasScan && ! $isLegacyCreator) {
                return response()->json([
                    'success' => false,
                    'message' => 'Card not found',
                ], 404);
            }
        }

        $validated = $request->validate([
            'company' => 'nullable|string|max:255',
            'company_english' => 'nullable|string|max:255',
            'name' => 'nullable|string|max:255',
            'name_english' => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:255',
            'phone' => 'nullable|array',
            'email' => 'nullable|string|max:255',
            'website' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'address_english' => 'nullable|string',
            'tagline_services' => 'nullable|string',
            'tax_id' => 'nullable|string|max:100',
            'social_profiles' => 'nullable|array',
            'accuracy_score' => 'nullable|integer|min:0|max:100',
            'accuracy_reason' => 'nullable|string',
            'detected_language' => 'nullable|string|max:100',
            'image_path' => 'nullable|string|max:500',
            'back_image_path' => 'nullable|string|max:500',
            'raw_data' => 'nullable|array',
        ]);

        $card->update($validated);

        if ($role === 'member') {
            $card->load([
                'exhibitions',
                'scans' => function ($sq) use ($user, $workspace) {
                    $sq->where('workspace_id', $workspace->id)
                        ->where('user_id', $user->id)
                        ->with(['user:id,name', 'exhibition:id,name']);
                },
            ]);
            $card->setAttribute('scanners', []);
        } else {
            $card->load(['exhibitions', 'scans.user:id,name', 'scans.exhibition:id,name', 'user:id,name']);
            $scanners = $card->scans
                ->filter(fn ($scan) => $scan->user !== null)
                ->map(fn ($scan) => [
                    'id' => $scan->user->id,
                    'name' => $scan->user->name,
                ])
                ->unique('id')
                ->values();
            if ($scanners->isEmpty() && $card->user) {
                $scanners = collect([[
                    'id' => $card->user->id,
                    'name' => $card->user->name,
                ]]);
            }
            $card->setAttribute('scanners', $scanners);
        }

        return response()->json([
            'success' => true,
            'message' => 'Card updated successfully.',
            'card' => $card,
        ]);
    }

    /**
     * Remove the specified card with workspace and role authorization.
     * Only Workspace Owners and Admins are permitted to delete cards.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');

        // Enforce role authorization: Members cannot delete records
        if (! in_array($role, ['owner', 'admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only workspace owners and admins can delete cards.',
            ], 403);
        }

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found',
            ], 404);
        }

        // Clean up private stored front and back images
        if ($card->image_path && Storage::disk('local')->exists($card->image_path)) {
            Storage::disk('local')->delete($card->image_path);
        }
        if ($card->back_image_path && Storage::disk('local')->exists($card->back_image_path)) {
            Storage::disk('local')->delete($card->back_image_path);
        }

        $card->delete();

        return response()->json([
            'success' => true,
            'message' => 'Card deleted successfully',
        ]);
    }

    /**
     * Securely serve a card's front or back image strictly to members of the workspace.
     * Enforces member-level isolation and IDOR protection.
     */
    public function image(Request $request, int $id): Response
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found.',
            ], 404);
        }

        if ($role === 'member') {
            $hasScan = $card->scans()->where('workspace_id', $workspace->id)->where('user_id', $user->id)->exists();
            $isLegacyCreator = ($card->user_id === $user->id && $card->scans()->count() === 0);

            if (! $hasScan && ! $isLegacyCreator) {
                return response()->json([
                    'success' => false,
                    'message' => 'Card not found.',
                ], 404);
            }
        }

        $targetPath = null;
        if ($scanId = $request->query('scan_id')) {
            $scanQuery = CardScan::where('workspace_id', $workspace->id)
                ->where('card_id', $card->id)
                ->where('id', $scanId);

            if ($role === 'member') {
                $scanQuery->where('user_id', $user->id);
            }

            $scan = $scanQuery->first();
            if (! $scan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Scan record not found or access denied.',
                ], 404);
            }
            $targetPath = ($request->query('type') === 'back') ? $scan->back_image_path : $scan->front_image_path;
        } elseif ($role === 'member') {
            // Serve member's latest scan image if available
            $memberScan = $card->scans()->where('workspace_id', $workspace->id)->where('user_id', $user->id)->latest('scanned_at')->first();
            if ($memberScan) {
                $targetPath = ($request->query('type') === 'back')
                    ? ($memberScan->back_image_path ?: $card->back_image_path)
                    : ($memberScan->front_image_path ?: $card->image_path);
            } else {
                $targetPath = ($request->query('type') === 'back') ? $card->back_image_path : $card->image_path;
            }
        } else {
            $targetPath = ($request->query('type') === 'back') ? $card->back_image_path : $card->image_path;
        }

        if (! $targetPath) {
            return response()->json([
                'success' => false,
                'message' => 'Card image not found.',
            ], 404);
        }

        // Check private local storage first
        $localDisk = Storage::disk('local');
        if ($localDisk->exists($targetPath)) {
            $resp = response()->file($localDisk->path($targetPath));
            $resp->setPrivate();
            $resp->setMaxAge(3600);

            return $resp;
        }

        // Check legacy public storage if applicable
        if (str_starts_with($targetPath, '/storage/')) {
            $publicRelative = Str::after($targetPath, '/storage/');
            $publicDisk = Storage::disk('public');
            if ($publicDisk->exists($publicRelative)) {
                $resp = response()->file($publicDisk->path($publicRelative));
                $resp->setPrivate();
                $resp->setMaxAge(3600);

                return $resp;
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Card image file missing on storage disk.',
        ], 404);
    }

    /**
     * Resolve target exhibition for card association.
     */
    protected function resolveTargetExhibition(?int $exhibitionId, Workspace $workspace, int $userId): Exhibition
    {
        if ($exhibitionId) {
            $exhibition = Exhibition::where('workspace_id', $workspace->id)->find($exhibitionId);
            if (! $exhibition) {
                abort(response()->json([
                    'success' => false,
                    'message' => 'Specified exhibition not found in this workspace.',
                ], 404));
            }

            if ($exhibition->isArchived()) {
                abort(response()->json([
                    'success' => false,
                    'message' => 'Cannot associate cards with an archived exhibition.',
                ], 422));
            }

            return $exhibition;
        }

        // Resolve user's current selected exhibition
        $selectedId = UserSelectedExhibition::where('user_id', $userId)
            ->where('workspace_id', $workspace->id)
            ->value('exhibition_id');

        if ($selectedId) {
            $selected = Exhibition::where('workspace_id', $workspace->id)
                ->where('id', $selectedId)
                ->first();

            if ($selected && ! $selected->isArchived()) {
                return $selected;
            }
        }

        // Fallback: first active exhibition
        $fallback = Exhibition::where('workspace_id', $workspace->id)
            ->where('status', 'active')
            ->first();

        // Fallback 2: any non-archived exhibition
        if (! $fallback) {
            $fallback = Exhibition::where('workspace_id', $workspace->id)
                ->where('status', '!=', 'archived')
                ->first();
        }

        // Fallback 3: General Exhibition
        if (! $fallback) {
            $fallback = Exhibition::create([
                'workspace_id' => $workspace->id,
                'created_by_user_id' => $userId,
                'name' => 'General Exhibition',
                'description' => 'Default workspace collection for general cards and scans.',
                'status' => 'active',
            ]);
        }

        UserSelectedExhibition::updateOrCreate(
            ['user_id' => $userId, 'workspace_id' => $workspace->id],
            ['exhibition_id' => $fallback->id]
        );

        return $fallback;
    }

    /**
     * Export workspace contacts to CSV.
     * Enforces plan entitlement for 'export_csv'.
     */
    public function export(Request $request)
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        if (! $workspace->hasFeature('export_csv')) {
            return response()->json([
                'success' => false,
                'error_code' => 'FEATURE_NOT_INCLUDED',
                'message' => 'CSV/Excel export is not included in your current plan. Please upgrade to Pro or Business.',
                'feature' => 'export_csv',
            ], 403);
        }

        $query = Card::forWorkspace($workspace->id)->with(['exhibitions']);

        if ($role === 'member') {
            $query->whereHas('scans', function ($sq) use ($workspace, $user) {
                $sq->where('workspace_id', $workspace->id)
                    ->where('user_id', $user->id);
            });
        }

        $cards = $query->latest('id')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="contacts_export_'.now()->format('Y-m-d').'.csv"',
        ];

        $callback = function () use ($cards) {
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($output, [
                'ID',
                'Name',
                'Name (English)',
                'Company',
                'Company (English)',
                'Designation',
                'Department',
                'Phone',
                'Email',
                'Website',
                'Address',
                'Exhibitions',
                'Created At',
            ]);

            foreach ($cards as $card) {
                $phones = is_array($card->phone) ? implode('; ', $card->phone) : (string) $card->phone;
                $exhibitionNames = $card->exhibitions->pluck('name')->implode('; ');

                fputcsv($output, [
                    $card->id,
                    $card->name,
                    $card->name_english,
                    $card->company,
                    $card->company_english,
                    $card->designation,
                    $card->department,
                    $phones,
                    $card->email,
                    $card->website,
                    $card->address,
                    $exhibitionNames,
                    $card->created_at?->toIso8601String(),
                ]);
            }

            fclose($output);
        };

        return response()->stream($callback, 200, $headers);
    }
}
