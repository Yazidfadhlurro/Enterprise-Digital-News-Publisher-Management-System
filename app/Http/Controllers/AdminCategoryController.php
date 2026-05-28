<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Support\CachedLookups;
use App\Support\ContentSanitizer;

class AdminCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = DB::table('categories as c')
            ->leftJoin('articles as a', 'a.category_id', '=', 'c.id')
            ->select(
                'c.id',
                'c.name',
                'c.slug',
                'c.created_at',
                DB::raw('COUNT(a.id) as articles_count')
            )
            ->groupBy('c.id', 'c.name', 'c.slug', 'c.created_at')
            ->orderBy('c.name')
            ->get()
            ->map(function ($category) {
                return [
                    'id' => (int) $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'articles_count' => (int) $category->articles_count,
                    'created_at' => $category->created_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Data kategori berhasil dimuat.',
            'data' => [
                'categories' => $categories,
                'total' => $categories->count(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $category = $this->fetchCategoryById($id);

        if (!$category) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kategori tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Detail kategori berhasil dimuat.',
            'id' => $category['id'],
            'name' => $category['name'],
            'slug' => $category['slug'],
            'data' => [
                'category' => $category,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $name = ContentSanitizer::sanitizePlainText($validated['name']);
        $description = filled($validated['description'] ?? null)
            ? ContentSanitizer::sanitizePlainText($validated['description'])
            : null;
        $slugSource = trim((string) ($validated['slug'] ?? $name));
        $slug = $this->makeUniqueSlug($slugSource);
        $now = now();

        $categoryId = DB::table('categories')->insertGetId([
            'name' => $name,
            'slug' => $slug,
            'description' => $description,
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        CachedLookups::forgetActiveCategories();

        $created = $this->fetchCategoryById($categoryId);

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil dibuat.',
            'id' => $created['id'],
            'name' => $created['name'],
            'slug' => $created['slug'],
            'data' => [
                'category' => $created,
            ],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $existingCategory = DB::table('categories')->where('id', $id)->first();

        if (!$existingCategory) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kategori tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (empty($validated)) {
            throw ValidationException::withMessages([
                'request' => ['Tidak ada data yang diperbarui.'],
            ]);
        }

        $updates = [];
        $nextName = array_key_exists('name', $validated)
            ? trim((string) $validated['name'])
            : (string) $existingCategory->name;

        if (array_key_exists('name', $validated)) {
            $updates['name'] = ContentSanitizer::sanitizePlainText($nextName);
        }

        if (array_key_exists('slug', $validated)) {
            $slugSource = trim((string) ($validated['slug'] ?? $nextName));
            $updates['slug'] = $this->makeUniqueSlug($slugSource, $id);
        } elseif (array_key_exists('name', $validated)) {
            $updates['slug'] = $this->makeUniqueSlug($nextName, $id);
        }

        if (array_key_exists('description', $validated)) {
            $updates['description'] = filled($validated['description'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['description'])
                : null;
        }

        if (array_key_exists('is_active', $validated)) {
            $updates['is_active'] = (bool) $validated['is_active'];
        }

        $updates['updated_at'] = now();

        DB::table('categories')->where('id', $id)->update($updates);

        CachedLookups::forgetActiveCategories();

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil diperbarui.',
            'data' => [
                'category' => $this->fetchCategoryById($id),
            ],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $category = DB::table('categories')->where('id', $id)->first();

        if (!$category) {
            return response()->json([
                'status' => 'error',
                'message' => 'Kategori tidak ditemukan.',
            ], 404);
        }

        DB::table('categories')->where('id', $id)->delete();

        CachedLookups::forgetActiveCategories();

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil dihapus.',
        ]);
    }

    private function fetchCategoryById(int $id): ?array
    {
        $category = DB::table('categories as c')
            ->leftJoin('articles as a', 'a.category_id', '=', 'c.id')
            ->select(
                'c.id',
                'c.name',
                'c.slug',
                'c.description',
                'c.is_active',
                'c.created_at',
                'c.updated_at',
                DB::raw('COUNT(a.id) as articles_count')
            )
            ->where('c.id', $id)
            ->groupBy('c.id', 'c.name', 'c.slug', 'c.description', 'c.is_active', 'c.created_at', 'c.updated_at')
            ->first();

        if (!$category) {
            return null;
        }

        return [
            'id' => (int) $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'is_active' => (bool) $category->is_active,
            'articles_count' => (int) $category->articles_count,
            'created_at' => $category->created_at,
            'updated_at' => $category->updated_at,
        ];
    }

    private function makeUniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($source);
        $baseSlug = $baseSlug !== '' ? $baseSlug : 'kategori';
        $slug = $baseSlug;
        $counter = 2;

        while (true) {
            $query = DB::table('categories')->where('slug', $slug);

            if ($ignoreId) {
                $query->where('id', '!=', $ignoreId);
            }

            if (!$query->exists()) {
                return $slug;
            }

            $slug = $baseSlug.'-'.$counter;
            $counter += 1;
        }
    }
}
