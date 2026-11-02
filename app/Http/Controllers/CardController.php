<?php

namespace App\Http\Controllers;

use App\Models\Card;
use App\Services\CardDuplicateDetector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
     * Display a listing of saved cards.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Card::query()->latest();

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
     */
    public function scan(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'nullable|file|mimes:jpeg,png,jpg,webp|max:16384',
            'image_base64' => 'nullable|string',
        ]);

        $apiKey = env('GEMINI_API_KEY');
        if (! $apiKey) {
            return response()->json([
                'success' => false,
                'message' => 'GEMINI_API_KEY is not configured in your .env file',
            ], 500);
        }

        $mimeType = 'image/jpeg';
        $rawBytes = null;
        $savedImagePath = null;

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $mimeType = $file->getMimeType() ?: 'image/jpeg';
            $rawBytes = file_get_contents($file->getRealPath());

            $filename = 'cards/'.Str::uuid().'.'.($file->getClientOriginalExtension() ?: 'jpg');
            Storage::disk('public')->put($filename, $rawBytes);
            $savedImagePath = '/storage/'.$filename;
        } elseif ($request->filled('image_base64')) {
            $raw = $request->input('image_base64');
            if (preg_match('/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/', $raw, $matches)) {
                $mimeType = $matches[1];
                $rawBytes = base64_decode($matches[2]);
            } else {
                $rawBytes = base64_decode($raw);
            }

            if ($rawBytes) {
                $filename = 'cards/'.Str::uuid().'.jpg';
                Storage::disk('public')->put($filename, $rawBytes);
                $savedImagePath = '/storage/'.$filename;
            }
        }

        if (! $rawBytes) {
            return response()->json([
                'success' => false,
                'message' => 'No image file or base64 data received.',
            ], 422);
        }

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

Return STRICTLY a JSON object with this exact structure and nothing else (no markdown fences, just pure JSON):
{
  "company": "Company / Shop / Firm name in original script or English",
  "company_english": "Transliterated or English name of company",
  "name": "Person name in original script or English if present, else null",
  "name_english": "Person name in English if present, else null",
  "designation": "Designation/Title (e.g. Owner, Director, Manager) if present, else null",
  "department": "Department if present, else null",
  "phone": ["Array of phone numbers extracted"],
  "email": "Email address if present, else null",
  "website": "Website URL if present, else null",
  "address": "Full postal address in original script",
  "address_english": "Full postal address transliterated/in English",
  "tagline_services": "Services offered, tagline, or product category if present, else null",
  "tax_id": "GSTIN / VAT / PAN / Reg. No. if present, else null",
  "social_profiles": ["Social media handles or WhatsApp icons if present"],
  "detected_language": "Gujarati / Hindi / English / Multilingual",
  "accuracy_score": 95,
  "accuracy_reason": "Detailed explanation of scan confidence, text clarity, and extracted fields"
}
EOT;

        // Models to try in priority order
        $candidateModels = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash'];
        $lastError = 'Unknown error';
        $extractedData = null;

        foreach ($candidateModels as $model) {
            $result = $this->callGeminiApiCurl($apiKey, $model, $prompt, $mimeType, $base64Data);

            if ($result['success']) {
                $extractedData = $result['data'];
                break;
            } else {
                $lastError = $result['error'];
                Log::warning("Gemini error with {$model}: ".$lastError);
            }
        }

        if (! $extractedData) {
            return response()->json([
                'success' => false,
                'message' => 'Gemini Scan failed: '.$lastError,
            ], 500);
        }

        $extractedData['image_path'] = $savedImagePath;

        return response()->json([
            'success' => true,
            'data' => $extractedData,
        ]);
    }

    /**
     * Direct cURL call to Gemini REST API to bypass Guzzle php://temp Windows disk issues.
     */
    private function callGeminiApiCurl(string $apiKey, string $model, string $prompt, string $mimeType, string $base64Data): array
    {
        $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

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
            ],
            CURLOPT_POSTFIELDS => $jsonPayload,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false, // Prevents Windows SSL certificate bundle errors
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
     * Store a scanned or edited card in the database with duplicate detection.
     */
    public function store(Request $request, CardDuplicateDetector $duplicateDetector): JsonResponse
    {
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

        // Run duplicate detection against existing contacts
        $duplicateResult = $duplicateDetector->detectDuplicates($validated);

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
                'name' => $validated['name'] ?? null,
                'company' => $validated['company'] ?? null,
                'match_count' => count($duplicateResult['matching_cards']),
            ]);
        }

        // Remove non-model attribute before Eloquent create
        unset($validated['force_duplicate']);

        $card = Card::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Card saved successfully to database!',
            'card' => $card,
            'duplicate_override' => $forceDuplicate && $duplicateResult['has_duplicates'],
        ], 201);
    }

    /**
     * Display the specified card.
     */
    public function show(int $id): JsonResponse
    {
        $card = Card::find($id);

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
     * Remove the specified card from storage.
     */
    public function destroy(int $id): JsonResponse
    {
        $card = Card::find($id);

        if (! $card) {
            return response()->json([
                'success' => false,
                'message' => 'Card not found',
            ], 404);
        }

        $card->delete();

        return response()->json([
            'success' => true,
            'message' => 'Card deleted successfully',
        ]);
    }
}
