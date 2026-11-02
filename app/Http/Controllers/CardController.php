<?php

namespace App\Http\Controllers;

use App\Models\Card;
use App\Models\Workspace;
use App\Services\CardDuplicateDetector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
     */
    public function index(Request $request): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $query = Card::query()
            ->forWorkspace($workspace->id)
            ->latest();

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

        return response()->json([
            'success' => true,
            'cards' => $query->get(),
        ]);
    }

    /**
     * Scan an uploaded card image using Gemini Multimodal Vision API.
     * Uses private storage, strict image validation, and secure header authentication.
     */
    public function scan(Request $request): JsonResponse
    {
        $validatedImage = $this->validateAndExtractImage($request);

        if (! $validatedImage['success']) {
            return response()->json([
                'success' => false,
                'message' => $validatedImage['error'],
            ], $validatedImage['status'] ?? 422);
        }

        $apiKey = config('services.gemini.api_key');
        if (! $apiKey) {
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
        $storedPath = $validatedImage['storage_path'];

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

        if (! $geminiResult || ! $geminiResult['success']) {
            // Clean up stored image upon failed scan
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
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

        return response()->json([
            'success' => true,
            'data' => $extractedData,
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
     */
    private function validateAndExtractImage(Request $request): array
    {
        $rawBytes = null;
        $extension = 'jpg';
        $maxBytes = 16 * 1024 * 1024; // 16MB limit

        if ($request->hasFile('image')) {
            $request->validate([
                'image' => 'required|file|max:16384',
            ]);

            $file = $request->file('image');
            if (! $file->isValid()) {
                return ['success' => false, 'error' => 'Uploaded file is corrupted or incomplete.', 'status' => 422];
            }

            if ($file->getSize() > $maxBytes) {
                return ['success' => false, 'error' => 'Image exceeds 16MB limit.', 'status' => 413];
            }

            $rawBytes = file_get_contents($file->getRealPath());
            $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        } elseif ($request->filled('image_base64')) {
            $raw = $request->input('image_base64');

            // Prevent oversized base64 payloads
            if (strlen($raw) > 25 * 1024 * 1024) {
                return ['success' => false, 'error' => 'Base64 image payload exceeds maximum allowed size.', 'status' => 413];
            }

            if (preg_match('/^data:image\/(jpeg|png|webp);base64,(.+)$/', $raw, $matches)) {
                $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
                $rawBytes = base64_decode($matches[2], true);
            } else {
                $rawBytes = base64_decode($raw, true);
            }
        }

        if (! $rawBytes || strlen($rawBytes) < 50) {
            return ['success' => false, 'error' => 'Invalid or missing image payload.', 'status' => 422];
        }

        if (strlen($rawBytes) > $maxBytes) {
            return ['success' => false, 'error' => 'Image size exceeds maximum limit of 16MB.', 'status' => 413];
        }

        // Validate real MIME type using PHP fileinfo inspection
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $realMime = finfo_buffer($finfo, $rawBytes);
        finfo_close($finfo);

        $allowedMimes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];

        if (! array_key_exists($realMime, $allowedMimes)) {
            return [
                'success' => false,
                'error' => 'Invalid image format. Only JPEG, PNG, and WebP are permitted.',
                'status' => 422,
            ];
        }

        $extension = $allowedMimes[$realMime];

        // Validate image dimensions to prevent decompression bombs
        $imageSize = @getimagesizefromstring($rawBytes);
        if (! $imageSize || $imageSize[0] < 10 || $imageSize[1] < 10) {
            return ['success' => false, 'error' => 'Image dimensions are invalid or corrupted.', 'status' => 422];
        }

        if ($imageSize[0] > 9000 || $imageSize[1] > 9000) {
            return ['success' => false, 'error' => 'Image dimensions exceed maximum limit of 9000px.', 'status' => 422];
        }

        // Save safely into private storage (storage/app/private/cards)
        $relativePath = 'cards/'.Str::uuid().'.'.$extension;
        Storage::disk('local')->put($relativePath, $rawBytes);

        return [
            'success' => true,
            'raw_bytes' => $rawBytes,
            'mime_type' => $realMime,
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
     * Store a scanned or edited card in the database with workspace-scoped duplicate detection.
     */
    public function store(Request $request, CardDuplicateDetector $duplicateDetector): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

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
            'raw_data' => 'nullable|array',
            'force_duplicate' => 'nullable|boolean',
        ]);

        $forceDuplicate = filter_var($request->input('force_duplicate', false), FILTER_VALIDATE_BOOLEAN);

        // Run duplicate detection strictly against cards in the current workspace
        $duplicateResult = $duplicateDetector->detectDuplicates($validated, $workspace->id);

        if ($duplicateResult['has_duplicates']) {
            if (! $forceDuplicate) {
                $reasonText = match ($duplicateResult['primary_reason']) {
                    'phone' => 'A contact with this phone number is already saved in your directory.',
                    'email' => 'A contact with this email address is already saved in your directory.',
                    'name_company' => 'A card with this contact name and company already exists in your directory.',
                    default => 'A potential matching card already exists in your directory.',
                };

                return response()->json([
                    'success' => false,
                    'duplicate' => true,
                    'message' => $reasonText,
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

        // Remove non-model attribute before Eloquent create
        unset($validated['force_duplicate']);

        // Explicitly assign workspace and creator user
        $validated['workspace_id'] = $workspace->id;
        $validated['user_id'] = $request->user()->id;

        $card = Card::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Card saved successfully to database!',
            'card' => $card,
            'duplicate_override' => $forceDuplicate && $duplicateResult['has_duplicates'],
        ], 201);
    }

    /**
     * Display the specified card scoped to the user's workspace.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found',
            ], 404);
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

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found',
            ], 404);
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
            'raw_data' => 'nullable|array',
        ]);

        $card->update($validated);

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

        // If card has a private stored image, delete it
        if ($card->image_path && Storage::disk('local')->exists($card->image_path)) {
            Storage::disk('local')->delete($card->image_path);
        }

        $card->delete();

        return response()->json([
            'success' => true,
            'message' => 'Card deleted successfully',
        ]);
    }

    /**
     * Securely serve a card's image strictly to members of the workspace.
     */
    public function image(Request $request, int $id): Response
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $card = Card::forWorkspace($workspace->id)->find($id);

        if (! $card || ! $card->image_path) {
            return response()->json([
                'success' => false,
                'message' => 'Card image not found.',
            ], 404);
        }

        // Check private local storage first
        $localDisk = Storage::disk('local');
        if ($localDisk->exists($card->image_path)) {
            $resp = response()->file($localDisk->path($card->image_path));
            $resp->setPrivate();
            $resp->setMaxAge(3600);

            return $resp;
        }

        // Check legacy public storage if applicable
        if (str_starts_with($card->image_path, '/storage/')) {
            $publicRelative = Str::after($card->image_path, '/storage/');
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
}
