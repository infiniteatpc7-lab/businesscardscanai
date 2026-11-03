<?php

namespace App\Services;

use App\Exceptions\PermanentExtractionException;
use App\Exceptions\TransientGeminiException;
use Illuminate\Support\Facades\Storage;

class GeminiCardVisionService
{
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
        return config('services.gemini.model', 'gemini-2.5-flash');
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
     * @throws TransientGeminiException
     * @throws PermanentExtractionException
     */
    public function extractCardData(string $frontStoragePath, ?string $backStoragePath = null): array
    {
        $disk = Storage::disk('local');
        if (! $disk->exists($frontStoragePath)) {
            throw new PermanentExtractionException("Front card image not found at path: {$frontStoragePath}");
        }

        $rawBytes = $disk->get($frontStoragePath);
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_buffer($finfo, $rawBytes) ?: 'image/jpeg';
        finfo_close($finfo);

        $base64Data = base64_encode($rawBytes);
        $apiKey = $this->getApiKey();
        $model = $this->getModel();

        $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

        $parts = [
            ['text' => $this->prompt],
            [
                'inline_data' => [
                    'mime_type' => $mimeType,
                    'data' => $base64Data,
                ],
            ],
        ];

        // If back image exists, include as second image part
        if ($backStoragePath && $disk->exists($backStoragePath)) {
            $backBytes = $disk->get($backStoragePath);
            $finfoBack = finfo_open(FILEINFO_MIME_TYPE);
            $backMime = finfo_buffer($finfoBack, $backBytes) ?: 'image/jpeg';
            finfo_close($finfoBack);

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
            throw new TransientGeminiException("Network cURL error: {$curlError}");
        }

        // Handle HTTP Status classifications
        if (in_array($httpCode, [429, 500, 502, 503, 504], true)) {
            throw new TransientGeminiException("Gemini transient HTTP {$httpCode}: {$rawResponse}");
        }

        if ($httpCode !== 200) {
            $decodedErr = json_decode($rawResponse, true);
            $msg = $decodedErr['error']['message'] ?? $rawResponse;
            throw new PermanentExtractionException("Gemini permanent HTTP {$httpCode}: {$msg}");
        }

        $json = json_decode($rawResponse, true);
        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! $text) {
            throw new PermanentExtractionException('Gemini returned empty candidate content.');
        }

        $cleanText = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
        $cleanText = preg_replace('/\s*```$/i', '', $cleanText);
        $parsed = json_decode($cleanText, true);

        if (! is_array($parsed)) {
            throw new PermanentExtractionException('Unable to parse JSON from Gemini response: '.substr($cleanText, 0, 100));
        }

        return $parsed;
    }
}
