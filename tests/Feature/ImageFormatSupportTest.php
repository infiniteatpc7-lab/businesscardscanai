<?php

namespace Tests\Feature;

use App\Models\BulkImport;
use App\Models\Exhibition;
use App\Models\User;
use App\Models\Workspace;
use App\Services\CardImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImageFormatSupportTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceUser(string $email = 'user_img@example.com'): array
    {
        $user = User::create([
            'name' => 'Image Test User',
            'email' => $email,
            'password' => Hash::make('Secret123!'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Image Workspace',
            'slug' => 'img-ws-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);
        $workspace->users()->attach($user->id, ['role' => 'owner']);

        $tokenResult = $user->createToken('test_token');

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenResult['plain_token'],
        ];
    }

    /**
     * Create a realistic HEIC binary image payload with ISOBMFF ftyp heic box.
     */
    private function createFakeHeicBytes(): string
    {
        // 4 bytes size (24), 4 bytes 'ftyp', 4 bytes 'heic', 4 bytes minor_version (0), 8 bytes compatible brands ('mif1heic')
        $header = pack('N', 24).'ftypheic'.pack('N', 0).'mif1heic';
        // Pad with dummy media data so length > 100 bytes
        $body = str_repeat("\x00\x01\x02\x03\x04\x05\x06\x07", 20);

        return $header.$body;
    }

    /**
     * Create a small 50x50 valid PNG byte stream using GD.
     */
    private function createFakePngBytes(): string
    {
        $img = imagecreatetruecolor(50, 50);
        ob_start();
        imagepng($img);
        $bytes = ob_get_clean();
        imagedestroy($img);

        return $bytes;
    }

    /**
     * Create a small 50x50 valid BMP byte stream using GD.
     */
    private function createFakeBmpBytes(): string
    {
        $img = imagecreatetruecolor(50, 50);
        ob_start();
        imagebmp($img);
        $bytes = ob_get_clean();
        imagedestroy($img);

        return $bytes;
    }

    /**
     * Create a small 50x50 valid WebP byte stream using GD.
     */
    private function createFakeWebpBytes(): string
    {
        $img = imagecreatetruecolor(50, 50);
        ob_start();
        imagewebp($img);
        $bytes = ob_get_clean();
        imagedestroy($img);

        return $bytes;
    }

    public function test_card_image_service_accepts_heic_image(): void
    {
        $service = app(CardImageService::class);
        $heicBytes = $this->createFakeHeicBytes();

        $uploadedFile = UploadedFile::fake()->createWithContent('iphone_card.heic', $heicBytes);
        $request = Request::create('/test', 'POST', [], [], ['image' => $uploadedFile]);

        $result = $service->validateAndExtractImage($request);

        $this->assertTrue($result['success']);
        $this->assertEquals('heic', $result['extension']);
        $this->assertEquals('image/heic', $result['mime_type']);
        $this->assertNotEmpty($result['raw_bytes']);
    }

    public function test_card_image_service_accepts_heic_via_base64(): void
    {
        $service = app(CardImageService::class);
        $heicBytes = $this->createFakeHeicBytes();
        $base64 = 'data:image/heic;base64,'.base64_encode($heicBytes);

        $request = Request::create('/test', 'POST', ['image_base64' => $base64]);

        $result = $service->validateAndExtractImage($request);

        $this->assertTrue($result['success']);
        $this->assertEquals('heic', $result['extension']);
    }

    public function test_card_image_service_accepts_bmp_and_webp_and_png(): void
    {
        $service = app(CardImageService::class);

        // PNG
        $pngFile = UploadedFile::fake()->createWithContent('card.png', $this->createFakePngBytes());
        $reqPng = Request::create('/test', 'POST', [], [], ['image' => $pngFile]);
        $resPng = $service->validateAndExtractImage($reqPng);
        $this->assertTrue($resPng['success']);
        $this->assertEquals('png', $resPng['extension']);

        // WebP
        $webpFile = UploadedFile::fake()->createWithContent('card.webp', $this->createFakeWebpBytes());
        $reqWebp = Request::create('/test', 'POST', [], [], ['image' => $webpFile]);
        $resWebp = $service->validateAndExtractImage($reqWebp);
        $this->assertTrue($resWebp['success']);
        $this->assertEquals('webp', $resWebp['extension']);

        // BMP
        $bmpFile = UploadedFile::fake()->createWithContent('card.bmp', $this->createFakeBmpBytes());
        $reqBmp = Request::create('/test', 'POST', [], [], ['image' => $bmpFile]);
        $resBmp = $service->validateAndExtractImage($reqBmp);
        $this->assertTrue($resBmp['success']);
    }

    public function test_non_image_files_are_strictly_rejected(): void
    {
        $service = app(CardImageService::class);

        // Reject PDF
        $pdfContent = "%PDF-1.4\n".str_repeat("1 0 obj\n<< /Title (Invoice Document) >>\nendobj\n", 5)."trailer\n<<>>\n%%EOF";
        $pdfFile = UploadedFile::fake()->createWithContent('document.pdf', $pdfContent);
        $reqPdf = Request::create('/test', 'POST', [], [], ['image' => $pdfFile]);
        $resPdf = $service->validateAndExtractImage($reqPdf);
        $this->assertFalse($resPdf['success']);
        $this->assertEquals(422, $resPdf['status']);
        $this->assertStringContainsString('Only image formats', $resPdf['error']);

        // Reject Text file
        $txtContent = str_repeat('This is a plain text file, not an image format. ', 5);
        $txtFile = UploadedFile::fake()->createWithContent('notes.txt', $txtContent);
        $reqTxt = Request::create('/test', 'POST', [], [], ['image' => $txtFile]);
        $resTxt = $service->validateAndExtractImage($reqTxt);
        $this->assertFalse($resTxt['success']);
        $this->assertEquals(422, $resTxt['status']);
        $this->assertStringContainsString('Only image formats', $resTxt['error']);

        // Reject PHP script
        $phpContent = "<?php\n".str_repeat("// some malicious script\n", 5)."phpinfo();\n";
        $phpFile = UploadedFile::fake()->createWithContent('exploit.php', $phpContent);
        $reqPhp = Request::create('/test', 'POST', [], [], ['image' => $phpFile]);
        $resPhp = $service->validateAndExtractImage($reqPhp);
        $this->assertFalse($resPhp['success']);
        $this->assertEquals(422, $resPhp['status']);
        $this->assertStringContainsString('Only image formats', $resPhp['error']);
    }

    public function test_bulk_import_accepts_heic_image_upload(): void
    {
        Storage::fake('local');
        $auth = $this->createWorkspaceUser();

        // Grant bulk_import feature to the workspace plan
        $plan = $auth['workspace']->currentPlan();
        $plan->update(['features' => ['bulk_import']]);

        $exhibition = Exhibition::create([
            'workspace_id' => $auth['workspace']->id,
            'name' => 'Vibrant Ceramics 2026',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $auth['workspace']->id,
            'user_id' => $auth['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'batch-heic-test-'.uniqid(),
            'status' => 'pending',
            'max_batch_size' => 50,
        ]);

        $heicBytes = $this->createFakeHeicBytes();
        $heicFile = UploadedFile::fake()->createWithContent('card_photo.heic', $heicBytes);

        $response = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->postJson("/api/bulk-imports/{$batch->batch_uuid}/items", [
                'client_item_id' => 'item_heic_1',
                'image' => $heicFile,
            ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('item.client_item_id', 'item_heic_1');
    }
}
