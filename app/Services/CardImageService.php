<?php

namespace App\Services;

use App\Models\Card;
use App\Models\CardScan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CardImageService
{
    protected int $maxBytes = 16777216; // 16MB

    protected array $allowedMimes = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
        'image/heic-sequence' => 'heic',
        'image/heif-sequence' => 'heif',
        'image/avif' => 'avif',
        'image/bmp' => 'bmp',
        'image/x-ms-bmp' => 'bmp',
        'image/tiff' => 'tiff',
        'image/x-tiff' => 'tiff',
        'image/gif' => 'gif',
    ];

    /**
     * Strictly validate and extract raw image payload, inspect MIME with fileinfo,
     * check dimensions to prevent decompression bombs, and downscale to max 1800px.
     */
    public function validateAndExtractImage(Request $request, string $fileKey = 'image', string $base64Key = 'image_base64'): array
    {
        $rawBytes = null;
        $extension = 'jpg';

        if ($request->hasFile($fileKey)) {
            $file = $request->file($fileKey);
            if (! $file || ! $file->isValid()) {
                return ['success' => false, 'error' => 'Uploaded file is corrupted or incomplete.', 'status' => 422];
            }

            if ($file->getSize() > $this->maxBytes) {
                return ['success' => false, 'error' => 'Image exceeds 16MB limit.', 'status' => 413];
            }

            $rawBytes = file_get_contents($file->getRealPath());
            $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        } elseif ($request->filled($base64Key)) {
            $raw = (string) $request->input($base64Key);

            if (strlen($raw) > 26214400) { // 25MB base64 ceiling
                return ['success' => false, 'error' => 'Base64 image payload exceeds maximum allowed size.', 'status' => 413];
            }

            if (preg_match('/^data:image\/([a-zA-Z0-9\.\+\-]+);base64,(.+)$/s', $raw, $matches)) {
                $extCandidate = strtolower($matches[1]);
                $extension = ($extCandidate === 'jpeg') ? 'jpg' : $extCandidate;
                $rawBytes = base64_decode($matches[2], true);
            } else {
                $rawBytes = base64_decode($raw, true);
            }
        }

        if (! $rawBytes || strlen($rawBytes) < 50) {
            return ['success' => false, 'error' => 'Invalid or missing image payload.', 'status' => 422];
        }

        if (strlen($rawBytes) > $this->maxBytes) {
            return ['success' => false, 'error' => 'Image size exceeds maximum limit of 16MB.', 'status' => 413];
        }

        // Validate real MIME type via PHP fileinfo buffer inspection with HEIC/AVIF/TIFF fallbacks
        $realMime = $this->detectMimeType($rawBytes);

        if (! $realMime || ! array_key_exists($realMime, $this->allowedMimes)) {
            return [
                'success' => false,
                'error' => 'Invalid file format. Only image formats (JPG, PNG, WebP, HEIC, AVIF, BMP, TIFF) are permitted.',
                'status' => 422,
            ];
        }

        $extension = $this->allowedMimes[$realMime];

        // Check dimensions to prevent decompression bombs for GD-decodable formats
        $isHeicOrTiff = in_array($realMime, [
            'image/heic',
            'image/heif',
            'image/heic-sequence',
            'image/heif-sequence',
            'image/tiff',
            'image/x-tiff',
        ], true);

        if (! $isHeicOrTiff) {
            $imageSize = @getimagesizefromstring($rawBytes);
            if (! $imageSize || $imageSize[0] < 10 || $imageSize[1] < 10) {
                return ['success' => false, 'error' => 'Image dimensions are invalid or corrupted.', 'status' => 422];
            }

            if ($imageSize[0] > 9000 || $imageSize[1] > 9000) {
                return ['success' => false, 'error' => 'Image dimensions exceed maximum limit of 9000px.', 'status' => 422];
            }
        }

        $optimized = $this->optimizeImageBytes($rawBytes, $realMime);

        return [
            'success' => true,
            'raw_bytes' => $optimized['bytes'],
            'mime_type' => $optimized['mime'],
            'extension' => $extension,
        ];
    }

    /**
     * Inspect binary buffer to determine true image MIME type, including formats
     * like HEIC/HEIF or AVIF which may lack entries in default OS magic databases.
     */
    public function detectMimeType(string $rawBytes): ?string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $realMime = finfo_buffer($finfo, $rawBytes);
        finfo_close($finfo);

        if ($realMime && array_key_exists($realMime, $this->allowedMimes)) {
            return $realMime;
        }

        // Fallback for HEIC/HEIF
        if ($this->isHeicBytes($rawBytes)) {
            return 'image/heic';
        }

        // Fallback for TIFF
        if ($this->isTiffBytes($rawBytes)) {
            return 'image/tiff';
        }

        // Fallback for AVIF
        if ($this->isAvifBytes($rawBytes)) {
            return 'image/avif';
        }

        return null;
    }

    /**
     * Determine if binary payload is a valid HEIC/HEIF image (ISOBMFF with ftyp heic/mif1 brand).
     */
    public function isHeicBytes(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }
        if (substr($bytes, 4, 4) !== 'ftyp') {
            return false;
        }
        $brand = strtolower(substr($bytes, 8, 4));
        if (in_array($brand, ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1'], true)) {
            return true;
        }
        $compat = strtolower(substr($bytes, 16, 32));

        return str_contains($compat, 'heic') || str_contains($compat, 'mif1');
    }

    /**
     * Determine if binary payload is a valid TIFF image (Little or Big-Endian signature).
     */
    public function isTiffBytes(string $bytes): bool
    {
        if (strlen($bytes) < 4) {
            return false;
        }

        return substr($bytes, 0, 4) === "II*\x00" || substr($bytes, 0, 4) === "MM\x00*";
    }

    /**
     * Determine if binary payload is a valid AVIF image.
     */
    public function isAvifBytes(string $bytes): bool
    {
        if (strlen($bytes) < 12) {
            return false;
        }

        return substr($bytes, 4, 4) === 'ftyp' && in_array(strtolower(substr($bytes, 8, 4)), ['avif', 'avis'], true);
    }

    /**
     * Downscale high-resolution mobile camera images to optimum OCR size (max 1800px).
     */
    public function optimizeImageBytes(string $bytes, string $mime): array
    {
        if (! extension_loaded('gd') || strlen($bytes) < 1048576) {
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
     * Store image in private staging directory (bulk_staging/{batch_uuid}/).
     */
    public function storeStagedImage(Request $request, string $batchUuid, string $clientItemId, string $fileKey = 'image', string $base64Key = 'image_base64', string $suffix = 'front'): array
    {
        $validated = $this->validateAndExtractImage($request, $fileKey, $base64Key);
        if (! $validated['success']) {
            return $validated;
        }

        $relativePath = "bulk_staging/{$batchUuid}/{$clientItemId}_{$suffix}.{$validated['extension']}";
        Storage::disk('local')->put($relativePath, $validated['raw_bytes']);

        return [
            'success' => true,
            'storage_path' => $relativePath,
            'mime_type' => $validated['mime_type'],
        ];
    }

    /**
     * Safely copy staging images to permanent storage (cards/) with rollback recovery.
     * If the transaction fails, newly copied permanent files are deleted immediately.
     */
    public function executeWithPromotedImages(
        string $stagingFrontPath,
        ?string $stagingBackPath,
        callable $transactionCallback
    ): array {
        $disk = Storage::disk('local');
        $promotedFront = null;
        $promotedBack = null;

        try {
            if (! $disk->exists($stagingFrontPath)) {
                throw new \RuntimeException("Staging front image not found: {$stagingFrontPath}");
            }

            $frontExt = pathinfo($stagingFrontPath, PATHINFO_EXTENSION) ?: 'jpg';
            $promotedFront = 'cards/'.Str::uuid().'.'.$frontExt;
            $disk->copy($stagingFrontPath, $promotedFront);

            if (! $disk->exists($promotedFront) || $disk->size($promotedFront) === 0) {
                throw new \RuntimeException("Promoted front image verification failed for: {$promotedFront}");
            }

            if ($stagingBackPath && $disk->exists($stagingBackPath)) {
                $backExt = pathinfo($stagingBackPath, PATHINFO_EXTENSION) ?: 'jpg';
                $promotedBack = 'cards/'.Str::uuid().'.'.$backExt;
                $disk->copy($stagingBackPath, $promotedBack);

                if (! $disk->exists($promotedBack) || $disk->size($promotedBack) === 0) {
                    throw new \RuntimeException("Promoted back image verification failed for: {$promotedBack}");
                }
            }

            return DB::transaction(function () use ($transactionCallback, $promotedFront, $promotedBack) {
                return $transactionCallback($promotedFront, $promotedBack);
            });
        } catch (\Throwable $e) {
            // ROLLBACK RECOVERY: Remove newly promoted permanent files
            if ($promotedFront && $disk->exists($promotedFront)) {
                $disk->delete($promotedFront);
            }
            if ($promotedBack && $disk->exists($promotedBack)) {
                $disk->delete($promotedBack);
            }

            throw $e;
        }
    }

    /**
     * Reconcile permanent card storage: Delete ONLY unreferenced files older than threshold hours.
     */
    public function reconcileStorage(int $hoursThreshold = 2): array
    {
        $disk = Storage::disk('local');
        $files = $disk->files('cards');
        $cutoff = now()->subHours($hoursThreshold)->getTimestamp();
        $deleted = [];

        foreach ($files as $filePath) {
            try {
                $lastModified = $disk->lastModified($filePath);
                if ($lastModified > $cutoff) {
                    continue; // Skip active in-flight promotions
                }

                $referencedInCards = Card::where('image_path', $filePath)
                    ->orWhere('back_image_path', $filePath)
                    ->exists();

                $referencedInScans = CardScan::where('front_image_path', $filePath)
                    ->orWhere('back_image_path', $filePath)
                    ->exists();

                if (! $referencedInCards && ! $referencedInScans) {
                    $disk->delete($filePath);
                    $deleted[] = $filePath;
                }
            } catch (\Throwable $e) {
                Log::warning("Reconcile storage file check failed for {$filePath}: ".$e->getMessage());
            }
        }

        return [
            'scanned_count' => count($files),
            'deleted_count' => count($deleted),
            'deleted_files' => $deleted,
        ];
    }
}
