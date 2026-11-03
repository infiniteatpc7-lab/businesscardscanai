<?php

namespace App\Http\Controllers;

use App\Models\Exhibition;
use App\Models\UserSelectedExhibition;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExhibitionController extends Controller
{
    /**
     * List all exhibitions belonging to the authenticated user's workspace.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $selectedExhibitionId = UserSelectedExhibition::where('user_id', $user->id)
            ->where('workspace_id', $workspace->id)
            ->value('exhibition_id');

        $query = Exhibition::query()
            ->where('workspace_id', $workspace->id)
            ->withCount(['cards', 'cardScans']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $exhibitions = $query
            ->orderByRaw("CASE WHEN status = 'active' THEN 1 WHEN status = 'upcoming' THEN 2 WHEN status = 'completed' THEN 3 ELSE 4 END")
            ->latest('id')
            ->get()
            ->map(function (Exhibition $exhibition) use ($selectedExhibitionId) {
                $data = $exhibition->toArray();
                $data['is_selected'] = ($exhibition->id === $selectedExhibitionId);

                return $data;
            });

        return response()->json([
            'success' => true,
            'exhibitions' => $exhibitions,
            'current_exhibition_id' => $selectedExhibitionId,
        ]);
    }

    /**
     * Get the authenticated user's current selected exhibition for the active workspace.
     */
    public function current(Request $request): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $exhibition = $this->resolveSelectedExhibition($user->id, $workspace);

        return response()->json([
            'success' => true,
            'exhibition' => $exhibition ? $exhibition->loadCount(['cards', 'cardScans']) : null,
        ]);
    }

    /**
     * Select/switch the user's active exhibition for this workspace.
     */
    public function select(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'exhibition_id' => 'required|integer',
        ]);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $exhibition = Exhibition::where('workspace_id', $workspace->id)
            ->withCount(['cards', 'cardScans'])
            ->find($validated['exhibition_id']);

        if (! $exhibition) {
            return response()->json([
                'success' => false,
                'message' => 'Exhibition not found in this workspace.',
            ], 404);
        }

        if ($exhibition->isArchived()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot select an archived exhibition.',
            ], 422);
        }

        UserSelectedExhibition::updateOrCreate(
            [
                'user_id' => $user->id,
                'workspace_id' => $workspace->id,
            ],
            [
                'exhibition_id' => $exhibition->id,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Active exhibition updated successfully.',
            'exhibition' => $exhibition,
        ]);
    }

    /**
     * Create a new exhibition in the workspace (Owner & Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $role = $request->attributes->get('workspace_role');
        if ($role !== 'owner' && $role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Only workspace owners and admins can create exhibitions.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'organizer' => 'nullable|string|max:255',
            'venue' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'description' => 'nullable|string|max:2000',
            'status' => ['nullable', 'string', Rule::in(['upcoming', 'active', 'completed', 'archived'])],
            'set_as_current' => 'nullable|boolean',
        ]);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $exhibition = Exhibition::create([
            'workspace_id' => $workspace->id,
            'created_by_user_id' => $user->id,
            'name' => $validated['name'],
            'organizer' => $validated['organizer'] ?? null,
            'venue' => $validated['venue'] ?? null,
            'city' => $validated['city'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'active',
        ]);

        $setAsCurrent = $request->boolean('set_as_current', true);
        if ($setAsCurrent && $exhibition->status !== 'archived') {
            UserSelectedExhibition::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'workspace_id' => $workspace->id,
                ],
                [
                    'exhibition_id' => $exhibition->id,
                ]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Exhibition created successfully.',
            'exhibition' => $exhibition->loadCount(['cards', 'cardScans']),
        ], 201);
    }

    /**
     * Get specific exhibition details (Owner, Admin, Member).
     */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $exhibition = Exhibition::where('workspace_id', $workspace->id)
            ->withCount(['cards', 'cardScans'])
            ->find($id);

        if (! $exhibition) {
            return response()->json([
                'success' => false,
                'message' => 'Exhibition not found in this workspace.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'exhibition' => $exhibition,
        ]);
    }

    /**
     * Update an exhibition (Owner & Admin only).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $role = $request->attributes->get('workspace_role');
        if ($role !== 'owner' && $role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Only workspace owners and admins can update exhibitions.',
            ], 403);
        }

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $exhibition = Exhibition::where('workspace_id', $workspace->id)->find($id);
        if (! $exhibition) {
            return response()->json([
                'success' => false,
                'message' => 'Exhibition not found in this workspace.',
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'organizer' => 'nullable|string|max:255',
            'venue' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'description' => 'nullable|string|max:2000',
            'status' => ['required', 'string', Rule::in(['upcoming', 'active', 'completed', 'archived'])],
        ]);

        $exhibition->update([
            'name' => $validated['name'],
            'organizer' => $validated['organizer'] ?? null,
            'venue' => $validated['venue'] ?? null,
            'city' => $validated['city'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'],
        ]);

        // If newly archived, resolve selection fallback for users currently selecting it
        if ($exhibition->isArchived()) {
            $this->reassignArchivedSelections($workspace, $exhibition->id);
        }

        return response()->json([
            'success' => true,
            'message' => 'Exhibition updated successfully.',
            'exhibition' => $exhibition->loadCount(['cards', 'cardScans']),
        ]);
    }

    /**
     * Delete or archive an exhibition (Owner & Admin only).
     * Rule: Exhibitions with associated cards or scan history cannot be hard deleted.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $role = $request->attributes->get('workspace_role');
        if ($role !== 'owner' && $role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Only workspace owners and admins can delete or archive exhibitions.',
            ], 403);
        }

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $exhibition = Exhibition::where('workspace_id', $workspace->id)->find($id);
        if (! $exhibition) {
            return response()->json([
                'success' => false,
                'message' => 'Exhibition not found in this workspace.',
            ], 404);
        }

        $cardsCount = $exhibition->cards()->count();
        $scansCount = $exhibition->cardScans()->count();

        // If exhibition has cards or scans, archive it instead of hard deleting
        if ($cardsCount > 0 || $scansCount > 0) {
            $exhibition->update(['status' => 'archived']);
            $this->reassignArchivedSelections($workspace, $exhibition->id);

            return response()->json([
                'success' => true,
                'archived' => true,
                'message' => 'Exhibition has associated contacts or scans. It has been safely archived instead of deleted.',
                'exhibition' => $exhibition->loadCount(['cards', 'cardScans']),
            ]);
        }

        // Clean delete if empty
        $this->reassignArchivedSelections($workspace, $exhibition->id);
        $exhibition->delete();

        return response()->json([
            'success' => true,
            'archived' => false,
            'message' => 'Exhibition deleted successfully.',
        ]);
    }

    /**
     * Helper: Resolve and persist user's active exhibition.
     */
    protected function resolveSelectedExhibition(int $userId, Workspace $workspace): ?Exhibition
    {
        $selectedId = UserSelectedExhibition::where('user_id', $userId)
            ->where('workspace_id', $workspace->id)
            ->value('exhibition_id');

        if ($selectedId) {
            $exhibition = Exhibition::where('workspace_id', $workspace->id)
                ->where('id', $selectedId)
                ->first();

            if ($exhibition && ! $exhibition->isArchived()) {
                return $exhibition;
            }
        }

        // Fallback 1: First active exhibition
        $fallback = Exhibition::where('workspace_id', $workspace->id)
            ->where('status', 'active')
            ->first();

        // Fallback 2: Any non-archived exhibition
        if (! $fallback) {
            $fallback = Exhibition::where('workspace_id', $workspace->id)
                ->where('status', '!=', 'archived')
                ->first();
        }

        // Fallback 3: Create General Exhibition if empty
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
            [
                'user_id' => $userId,
                'workspace_id' => $workspace->id,
            ],
            [
                'exhibition_id' => $fallback->id,
            ]
        );

        return $fallback;
    }

    /**
     * Reassign user selections when an exhibition is archived or deleted.
     */
    protected function reassignArchivedSelections(Workspace $workspace, int $archivedExhibitionId): void
    {
        $fallback = Exhibition::where('workspace_id', $workspace->id)
            ->where('id', '!=', $archivedExhibitionId)
            ->where('status', 'active')
            ->first();

        if (! $fallback) {
            $fallback = Exhibition::where('workspace_id', $workspace->id)
                ->where('id', '!=', $archivedExhibitionId)
                ->where('status', '!=', 'archived')
                ->first();
        }

        if ($fallback) {
            UserSelectedExhibition::where('workspace_id', $workspace->id)
                ->where('exhibition_id', $archivedExhibitionId)
                ->update(['exhibition_id' => $fallback->id]);
        }
    }
}
