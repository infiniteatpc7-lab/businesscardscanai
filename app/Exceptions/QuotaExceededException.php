<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuotaExceededException extends Exception
{
    public function __construct(
        string $message = 'Workspace monthly business card scan quota exceeded.',
        public int $monthlyAllowance = 0,
        public int $usedCredits = 0,
        public int $remainingCredits = 0,
        public string $planName = 'Free',
        int $code = 403
    ) {
        parent::__construct($message, $code);
    }

    /**
     * Render the exception into an HTTP response.
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error_code' => 'QUOTA_EXCEEDED',
            'message' => $this->getMessage(),
            'quota' => [
                'plan' => $this->planName,
                'monthly_allowance' => $this->monthlyAllowance,
                'allowance' => $this->monthlyAllowance,
                'used_credits' => $this->usedCredits,
                'used' => $this->usedCredits,
                'remaining_credits' => $this->remainingCredits,
                'remaining' => $this->remainingCredits,
            ],
        ], 403);
    }
}
