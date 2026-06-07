<?php

namespace App\Http\Controllers;

use App\Support\CachedLookups;
use App\Support\EditorialActivityLogger;
use App\Support\ContentSanitizer;
use App\Support\MediaUrl;
use Illuminate\Support\Carbon;
use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthorArticleController extends Controller
{
    private const AUTHOR_ALLOWED_STATUSES = ['draft', 'pending'];
    private const AUTHOR_EDITABLE_STATUSES = ['draft', 'revision'];
    private const EDITORIAL_STAGES = ['draft', 'review', 'revision', 'published'];

    public function dashboard(Request $request): JsonResponse
    {
        $authorId = (int) $request->user()->id;

        $statusCounts = DB::table('articles')
            ->where('author_id', $authorId)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $articles = DB::table('articles as a')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.author_id', $authorId)
            ->orderByDesc('a.updated_at')
            ->limit(10)
            ->get([
                'a.id',
                'a.title',
                'a.status',
                'a.featured_image',
                'a.updated_at',
                'a.created_at',
                DB::raw("COALESCE(c.name, '-') as category_name"),
            ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Dashboard penulis berhasil dimuat.',
            'data' => [
                'metrics' => [
                    'draft_total' => (int) ($statusCounts['draft'] ?? 0),
                    'review_total' => (int) ($statusCounts['pending'] ?? 0),
                    'revision_total' => (int) ($statusCounts['revision'] ?? 0),
                    'published_total' => (int) ($statusCounts['published'] ?? 0),
                ],
                'articles' => collect($articles)
                    ->map(fn ($article) => $this->mapArticleSummary($article))
                    ->values(),
            ],
        ]);
    }

    public function activities(Request $request): JsonResponse
    {
        $authorId = (int) $request->user()->id;
        $search = trim((string) $request->query('q', ''));
        $stage = trim((string) $request->query('stage', 'all'));

        $page = max(1, (int) $request->query('page', 1));
        $perPage = (int) $request->query('per_page', 12);
        $perPage = max(1, min($perPage, 50));

        $query = DB::table('editorial_activities as ea')
            ->join('articles as a', 'a.id', '=', 'ea.article_id')
            ->leftJoin('users as actor', 'actor.id', '=', 'ea.actor_id')
            ->where('a.author_id', $authorId);

        if ($stage !== '' && $stage !== 'all' && in_array($stage, self::EDITORIAL_STAGES, true)) {
            $query->where('ea.to_stage', $stage);
        }

        if ($search !== '') {
            $likeTerm = '%'.ContentSanitizer::escapeLikeWildcards($search, '!').'%';

            $query->where(function ($subQuery) use ($likeTerm) {
                $subQuery
                    ->whereRaw("a.title LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("actor.name LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("ea.to_stage LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("ea.from_stage LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("ea.note LIKE ? ESCAPE '!'", [$likeTerm]);
            });
        }

        $total = (clone $query)->count();
        $offset = ($page - 1) * $perPage;

        $stageSummary = (clone $query)
            ->select('ea.to_stage', DB::raw('COUNT(*) as total'))
            ->groupBy('ea.to_stage')
            ->pluck('total', 'ea.to_stage');

        $activities = $query
            ->orderByDesc('ea.occurred_at')
            ->offset($offset)
            ->limit($perPage)
            ->get([
                'ea.id',
                'ea.article_id',
                'ea.to_stage',
                'ea.occurred_at',
                'ea.note',
                'a.title',
                DB::raw("COALESCE(actor.name, '') as actor_name"),
            ]);

        $items = $activities
            ->values()
            ->map(function ($activity) {
                $stageName = (string) $activity->to_stage;
                $actorName = trim((string) $activity->actor_name);

                if ($actorName === '') {
                    $actorName = EditorialActivityLogger::defaultActorName($stageName);
                }

                return [
                    'id' => (int) $activity->id,
                    'article_id' => (int) $activity->article_id,
                    'stage' => $stageName,
                    'stage_label' => EditorialActivityLogger::stageLabel($stageName),
                    'actor_name' => $actorName,
                    'message' => EditorialActivityLogger::buildMessage($stageName, $actorName, (string) $activity->title),
                    'target' => $activity->title,
                    'note' => $activity->note,
                    'happened_at' => $activity->occurred_at,
                    'time' => Carbon::parse($activity->occurred_at)->diffForHumans(),
                ];
            });

        $lastPage = (int) ceil($total / $perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Log aktivitas editorial penulis berhasil dimuat.',
            'data' => [
                'activities' => $items,
                'summary' => [
                    'total' => $total,
                    'draft_total' => (int) ($stageSummary['draft'] ?? 0),
                    'review_total' => (int) ($stageSummary['review'] ?? 0),
                    'revision_total' => (int) ($stageSummary['revision'] ?? 0),
                    'published_total' => (int) ($stageSummary['published'] ?? 0),
                ],
                'pagination' => [
                    'total' => $total,
                    'per_page' => $perPage,
                    'current_page' => $page,
                    'last_page' => max(1, $lastPage),
                ],
            ],
        ]);
    }

    public function categories(): JsonResponse
    {
        $categories = CachedLookups::activeCategories();

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori penulis berhasil dimuat.',
            'data' => [
                'categories' => $categories,
            ],
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $name = ContentSanitizer::sanitizePlainText($validated['name']);
        $description = filled($validated['description'] ?? null)
            ? ContentSanitizer::sanitizePlainText($validated['description'])
            : null;

        if ($name === '') {
            throw ValidationException::withMessages([
                'name' => ['Nama kategori wajib diisi.'],
            ]);
        }

        $duplicateByName = DB::table('categories')
            ->whereRaw('LOWER(name) = ?', [Str::lower($name)])
            ->exists();

        if ($duplicateByName) {
            throw ValidationException::withMessages([
                'name' => ['Kategori dengan nama tersebut sudah ada.'],
            ]);
        }

        $now = now();
        $categoryId = DB::table('categories')->insertGetId([
            'name' => $name,
            'slug' => $this->makeUniqueCategorySlug($name),
            'description' => $description,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        CachedLookups::forgetActiveCategories();

        $category = DB::table('categories')
            ->where('id', $categoryId)
            ->first(['id', 'name', 'slug']);

        return response()->json([
            'status' => 'success',
            'message' => 'Kategori berhasil ditambahkan.',
            'data' => [
                'category' => $category,
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $authorId = (int) $request->user()->id;
        $status = trim((string) $request->query('status', 'all'));
        $search = trim((string) $request->query('q', ''));

        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 50));

        $query = DB::table('articles as a')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.author_id', $authorId)
            ->select(
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.content',
                'a.status',
                'a.featured_image',
                'a.updated_at',
                'a.created_at',
                'a.category_id',
                DB::raw("COALESCE(c.name, '-') as category_name")
            );

        if ($status === 'review') {
            $query->where('a.status', 'pending');
        } elseif ($status !== '' && $status !== 'all') {
            $query->where('a.status', $status);
        }

        if ($search !== '') {
            $likeTerm = '%'.ContentSanitizer::escapeLikeWildcards($search, '!').'%';

            $query->where(function ($subQuery) use ($likeTerm) {
                $subQuery
                    ->whereRaw("a.title LIKE ? ESCAPE '!'", [$likeTerm])
                    ->orWhereRaw("c.name LIKE ? ESCAPE '!'", [$likeTerm]);
            });
        }

        $paginator = $query
            ->orderByDesc('a.updated_at')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel penulis berhasil dimuat.',
            'data' => [
                'articles' => collect($paginator->items())
                    ->map(fn ($article) => $this->mapArticleSummary($article))
                    ->values(),
                'pagination' => [
                    'total' => $paginator->total(),
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                ],
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $authorId = (int) $request->user()->id;

        $article = DB::table('articles as a')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.author_id', $authorId)
            ->where('a.id', $id)
            ->first([
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.content',
                'a.status',
                'a.featured_image',
                'a.featured_image_alt',
                'a.updated_at',
                'a.created_at',
                'a.category_id',
                DB::raw("COALESCE(c.name, '-') as category_name"),
            ]);

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        $detailed = MediaUrl::withFeaturedImageUrl([
            ...$this->mapArticleSummary($article),
            'slug' => $article->slug,
            'excerpt' => $article->excerpt,
            'content' => $article->content,
            'featured_image' => $article->featured_image,
            'featured_image_alt' => $article->featured_image_alt,
            'category_id' => $article->category_id ? (int) $article->category_id : null,
            'tags' => $this->articleTagNames((int) $article->id),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Detail artikel penulis berhasil dimuat.',
            'id' => $detailed['id'] ?? null,
            'title' => $detailed['title'] ?? null,
            'slug' => $detailed['slug'] ?? null,
            'content' => $detailed['content'] ?? null,
            'data' => [
                'article' => array_merge($detailed, [
                    'average_rating' => (float) DB::table('article_ratings')->where('article_id', $id)->avg('rating') ?? 0,
                    'ratings_total' => (int) DB::table('article_ratings')->where('article_id', $id)->count(),
                    'views_count' => (int) DB::table('articles')->where('id', $id)->value('views_count'),
                ]),
                'comments' => DB::table('article_comments as c')
                    ->leftJoin('users as u', 'u.id', '=', 'c.user_id')
                    ->where('c.article_id', $id)
                    ->where('c.is_approved', true)
                    ->orderByDesc('c.created_at')
                    ->limit(50)
                    ->get([
                        'c.id',
                        'c.content',
                        'c.created_at',
                        DB::raw("COALESCE(u.name, 'Pembaca') as commenter_name"),
                    ])
                    ->map(fn($r) => (array) $r)
                    ->values()
                    ->toArray(),
            ],
        ]);
    }

    public function mediaIndex(Request $request): JsonResponse
    {
        $authorId = (int) $request->user()->id;

        $mediaItems = DB::table('media_assets')
            ->where('uploader_id', $authorId)
            ->where('is_active', true)
            ->orderByDesc('created_at')
            ->limit(120)
            ->get([
                'id',
                'file_name',
                'file_path',
                'mime_type',
                'size_bytes',
                'width',
                'height',
                'alt_text',
                'created_at',
            ])
            ->map(function ($item) {
                return MediaUrl::withFileUrl([
                    'id' => (int) $item->id,
                    'file_name' => $item->file_name,
                    'file_path' => $item->file_path,
                    'mime_type' => $item->mime_type,
                    'size_bytes' => (int) $item->size_bytes,
                    'width' => $item->width ? (int) $item->width : null,
                    'height' => $item->height ? (int) $item->height : null,
                    'alt_text' => $item->alt_text,
                    'created_at' => $item->created_at,
                ]);
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Media library penulis berhasil dimuat.',
            'data' => [
                'media' => $mediaItems,
            ],
        ]);
    }

    public function mediaStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,mp4,webm,mov', 'max:20480'],
            'alt_text' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var UploadedFile $file */
        $file = $validated['file'];
        $authorId = (int) $request->user()->id;
        $altText = ContentSanitizer::sanitizePlainText((string) ($validated['alt_text'] ?? ''));
        $mimeType = (string) ($file->getClientMimeType() ?: $file->getMimeType() ?: '');
        $isImageUpload = str_starts_with($mimeType, 'image/');

        if ($isImageUpload && $altText === '') {
            return response()->json([
                'status' => 'error',
                'message' => 'Teks alternatif gambar wajib diisi.',
            ], 422);
        }

        $fileBinary = @file_get_contents($file->getRealPath());
        if ($fileBinary === false) {
            return response()->json([
                'status' => 'error',
                'message' => 'File tidak dapat dibaca. Coba unggah ulang.',
            ], 422);
        }
        $checksum = hash('sha256', $fileBinary);

        $existing = DB::table('media_assets')
            ->where('checksum', $checksum)
            ->first([
                'id',
                'is_active',
                'file_name',
                'file_path',
                'mime_type',
                'size_bytes',
                'width',
                'height',
                'alt_text',
            ]);

        if ($existing) {
            if (!(bool) ($existing->is_active ?? false)) {
                DB::table('media_assets')
                    ->where('id', (int) $existing->id)
                    ->update([
                        'is_active' => true,
                        'alt_text' => (string) ($existing->alt_text ?: $altText),
                        'updated_at' => now(),
                    ]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Media sudah ada dan digunakan kembali.',
                'data' => [
                    'media' => MediaUrl::withFileUrl([
                        'id' => (int) $existing->id,
                        'file_name' => $existing->file_name,
                        'file_path' => $existing->file_path,
                        'mime_type' => $existing->mime_type,
                        'size_bytes' => (int) $existing->size_bytes,
                        'width' => $existing->width ? (int) $existing->width : null,
                        'height' => $existing->height ? (int) $existing->height : null,
                        'alt_text' => $existing->alt_text ?: $altText,
                    ]),
                ],
            ]);
        }

        $stored = $this->compressAndStoreMedia($file, $authorId, $checksum);

        $mediaId = null;

        try {
            $mediaId = DB::table('media_assets')->insertGetId([
                'uploader_id' => $authorId,
                'file_name' => $stored['file_name'],
                'file_path' => $stored['file_path'],
                'mime_type' => $stored['mime_type'],
                'size_bytes' => $stored['size_bytes'],
                'width' => $stored['width'],
                'height' => $stored['height'],
                'alt_text' => $altText,
                'checksum' => $stored['checksum'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (QueryException $exception) {
            // Handle race-condition: another request inserted same checksum.
            $duplicate = DB::table('media_assets')
                ->where('checksum', $checksum)
                ->first([
                    'id',
                    'is_active',
                    'file_name',
                    'file_path',
                    'mime_type',
                    'size_bytes',
                    'width',
                    'height',
                    'alt_text',
                ]);

            if (!$duplicate) {
                throw $exception;
            }

            if (!(bool) ($duplicate->is_active ?? false)) {
                DB::table('media_assets')
                    ->where('id', (int) $duplicate->id)
                    ->update([
                        'is_active' => true,
                        'alt_text' => (string) ($duplicate->alt_text ?: $altText),
                        'updated_at' => now(),
                    ]);
            }

            // Cleanup file we just stored (best effort).
            if (!empty($stored['file_path'] ?? null)) {
                Storage::disk('public')->delete((string) $stored['file_path']);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Media sudah ada dan digunakan kembali.',
                'data' => [
                    'media' => MediaUrl::withFileUrl([
                        'id' => (int) $duplicate->id,
                        'file_name' => $duplicate->file_name,
                        'file_path' => $duplicate->file_path,
                        'mime_type' => $duplicate->mime_type,
                        'size_bytes' => (int) $duplicate->size_bytes,
                        'width' => $duplicate->width ? (int) $duplicate->width : null,
                        'height' => $duplicate->height ? (int) $duplicate->height : null,
                        'alt_text' => $duplicate->alt_text ?: $altText,
                    ]),
                ],
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Media berhasil diunggah.',
            'data' => [
                'media' => MediaUrl::withFileUrl([
                    'id' => (int) $mediaId,
                    'file_name' => $stored['file_name'],
                    'file_path' => $stored['file_path'],
                    'mime_type' => $stored['mime_type'],
                    'size_bytes' => $stored['size_bytes'],
                    'width' => $stored['width'],
                    'height' => $stored['height'],
                    'alt_text' => $altText,
                ]),
            ],
        ], 201);
    }

    public function mediaDestroy(Request $request, int $id): JsonResponse
    {
        $authorId = (int) $request->user()->id;

        $media = DB::table('media_assets')
            ->where('id', $id)
            ->where('uploader_id', $authorId)
            ->where('is_active', true)
            ->first(['id', 'file_path']);

        if (!$media) {
            return response()->json([
                'status' => 'error',
                'message' => 'Media tidak ditemukan.',
            ], 404);
        }

        $filePath = is_string($media->file_path ?? null) ? trim((string) $media->file_path) : '';

        DB::table('media_assets')
            ->where('id', $id)
            ->update([
                'is_active' => false,
                'updated_at' => now(),
            ]);

        // Best-effort delete physical file only if unused elsewhere.
        if ($filePath !== '' && !preg_match('#^https?://#i', $filePath) && !str_starts_with($filePath, '/')) {
            $stillUsedByMedia = DB::table('media_assets')
                ->where('is_active', true)
                ->where('file_path', $filePath)
                ->where('id', '!=', $id)
                ->exists();

            $stillUsedByArticle = DB::table('articles')
                ->where('featured_image', $filePath)
                ->exists();

            if (!$stillUsedByMedia && !$stillUsedByArticle) {
                Storage::disk('public')->delete($filePath);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Media berhasil dihapus.',
        ]);
    }

    public function versions(Request $request, int $id): JsonResponse
    {
        $authorId = (int) $request->user()->id;

        $articleExists = DB::table('articles')
            ->where('id', $id)
            ->where('author_id', $authorId)
            ->exists();

        if (!$articleExists) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        $versions = DB::table('article_versions')
            ->where('article_id', $id)
            ->orderByDesc('snapshot_at')
            ->limit(30)
            ->get([
                'id',
                'source',
                'title',
                'slug',
                'excerpt',
                'content',
                'category_id',
                'featured_image',
                'featured_image_alt',
                'snapshot_at',
            ])
            ->map(function ($version) {
                return [
                    'id' => (int) $version->id,
                    'source' => $version->source,
                    'title' => $version->title,
                    'slug' => $version->slug,
                    'excerpt' => $version->excerpt,
                    'content' => $version->content,
                    'category_id' => $version->category_id ? (int) $version->category_id : null,
                    'featured_image' => $version->featured_image,
                    'featured_image_alt' => $version->featured_image_alt,
                    'snapshot_at' => $version->snapshot_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'message' => 'Riwayat versi berhasil dimuat.',
            'data' => [
                'versions' => $versions,
            ],
        ]);
    }

    public function autosave(Request $request, int $id): JsonResponse
    {
        $authorId = (int) $request->user()->id;

        $article = DB::table('articles')
            ->where('id', $id)
            ->where('author_id', $authorId)
            ->first();

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        if (!in_array((string) $article->status, self::AUTHOR_EDITABLE_STATUSES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Autosave hanya tersedia untuk draft dan revisi.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'excerpt' => ['sometimes', 'nullable', 'string'],
            'content' => ['sometimes', 'required', 'string'],
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('categories', 'id')],
            'featured_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'featured_image_alt' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        if ($validated === []) {
            return response()->json([
                'status' => 'success',
                'message' => 'Tidak ada perubahan autosave.',
                'data' => [
                    'autosaved_at' => now()->toIso8601String(),
                ],
            ]);
        }

        $updates = [];

        if (array_key_exists('title', $validated)) {
            $updates['title'] = ContentSanitizer::sanitizePlainText($validated['title']);
        }

        if (array_key_exists('slug', $validated)) {
            $sourceSlug = trim((string) ($validated['slug'] ?? ($updates['title'] ?? $article->title)));
            $updates['slug'] = $this->makeUniqueSlug($sourceSlug, $id);
        }

        if (array_key_exists('excerpt', $validated)) {
            $updates['excerpt'] = filled($validated['excerpt'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['excerpt'])
                : null;
        }

        if (array_key_exists('content', $validated)) {
            $updates['content'] = ContentSanitizer::sanitizeRichText($validated['content']);
        }

        if (array_key_exists('category_id', $validated)) {
            $updates['category_id'] = $validated['category_id'];
        }

        if (array_key_exists('featured_image', $validated)) {
            $featuredImageInput = $validated['featured_image'];
            $featuredImage = ContentSanitizer::sanitizeMediaPath($featuredImageInput);

            if ($featuredImageInput !== null && trim((string) $featuredImageInput) !== '' && $featuredImage === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gambar unggulan tidak valid.',
                ], 422);
            }

            $updates['featured_image'] = $featuredImage;
        }

        if (array_key_exists('featured_image_alt', $validated)) {
            $updates['featured_image_alt'] = filled($validated['featured_image_alt'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['featured_image_alt'])
                : null;
        }

        $updates['updated_at'] = now();

        DB::table('articles')
            ->where('id', $id)
            ->update($updates);

        $freshArticle = DB::table('articles')->where('id', $id)->first();
        $this->createArticleVersion((object) $freshArticle, $authorId, 'autosave');

        return response()->json([
            'status' => 'success',
            'message' => 'Autosave berhasil.',
            'data' => [
                'autosaved_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'excerpt' => ['nullable', 'string'],
            'content' => ['required', 'string'],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')],
            'status' => ['nullable', Rule::in(self::AUTHOR_ALLOWED_STATUSES)],
            'featured_image' => ['nullable', 'string', 'max:255'],
            'featured_image_alt' => ['nullable', 'string', 'max:255'],
            'tags' => ['sometimes', 'array', 'max:5'],
            'tags.*' => ['string', 'max:50'],
            'meta_title' => ['nullable', 'string', 'max:70'],
            'meta_description' => ['nullable', 'string', 'max:160'],
            'og_image' => ['nullable', 'string', 'max:255'],
            'canonical_url' => ['nullable', 'url', 'max:255'],
        ]);

        $title = ContentSanitizer::sanitizePlainText($validated['title']);
        $status = $validated['status'] ?? 'draft';
        $slugSource = trim((string) ($validated['slug'] ?? $title));
        $slug = $this->makeUniqueSlug($slugSource);
        $now = now();

        $excerpt = filled($validated['excerpt'] ?? null)
            ? ContentSanitizer::sanitizePlainText($validated['excerpt'])
            : null;
        $content = ContentSanitizer::sanitizeRichText($validated['content']);
        $featuredImageInput = $validated['featured_image'] ?? null;
        $featuredImage = ContentSanitizer::sanitizeMediaPath($featuredImageInput);
        $featuredImageAlt = filled($validated['featured_image_alt'] ?? null)
            ? ContentSanitizer::sanitizePlainText($validated['featured_image_alt'])
            : null;

        if ($featuredImageInput !== null && trim((string) $featuredImageInput) !== '' && $featuredImage === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gambar unggulan tidak valid.',
            ], 422);
        }

        if ($status === 'pending' && blank($request->user()->fresh()?->assigned_reviewer_id)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Anda belum memiliki editor penanggung jawab. Hubungi admin untuk assignment editor.',
            ], 422);
        }

        $priorityScore = $this->calculatePriorityScore($title, $excerpt, $content);
        $reviewDueAt = $status === 'pending' ? $this->calculateReviewDueAt($priorityScore, $now) : null;
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        $articleId = DB::transaction(function () use ($request, $validated, $title, $slug, $status, $now, $priorityScore, $reviewDueAt, $actorId, $actorRole, $excerpt, $content, $featuredImage, $featuredImageAlt) {
            $createdArticleId = DB::table('articles')->insertGetId([
                'author_id' => (int) $request->user()->id,
                'category_id' => $validated['category_id'] ?? null,
                'title' => $title,
                'slug' => $slug,
                'excerpt' => $excerpt,
                'content' => $content,
                'featured_image' => $featuredImage,
                'featured_image_alt' => $featuredImageAlt,
                'status' => $status,
                'priority_score' => $priorityScore,
                'review_due_at' => $reviewDueAt,
                'reviewer_id' => null,
                'review_notes' => null,
                'published_at' => null,
                'is_featured' => false,
                'meta_title' => filled($validated['meta_title'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['meta_title']) : null,
                'meta_description' => filled($validated['meta_description'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['meta_description']) : null,
                'og_image' => ContentSanitizer::sanitizeMediaPath($validated['og_image'] ?? null),
                'canonical_url' => filled($validated['canonical_url'] ?? null) ? trim((string) $validated['canonical_url']) : null,
                'views_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            EditorialActivityLogger::logTransition(
                $createdArticleId,
                null,
                $status,
                $actorId,
                $actorRole,
                null,
                $now
            );

            return $createdArticleId;
        });

        if (array_key_exists('tags', $validated)) {
            $this->syncArticleTags($articleId, $validated['tags'] ?? []);
        }

        $createdArticle = DB::table('articles')->where('id', $articleId)->first();
        if ($createdArticle) {
            $this->createArticleVersion((object) $createdArticle, (int) $request->user()->id, 'create');
        }

        $created = $this->fetchArticleByAuthor((int) $request->user()->id, $articleId);

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil dibuat.',
            'id' => $created['id'] ?? null,
            'title' => $created['title'] ?? null,
            'slug' => $created['slug'] ?? null,
            'content' => $created['content'] ?? null,
            'data' => [
                'article' => $created,
            ],
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $authorId = (int) $request->user()->id;
        $existingArticle = DB::table('articles')
            ->where('id', $id)
            ->where('author_id', $authorId)
            ->first();

        if (!$existingArticle) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        if (!in_array($existingArticle->status, self::AUTHOR_EDITABLE_STATUSES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Status artikel saat ini tidak dapat diedit oleh penulis.',
            ], 422);
        }

        if ($existingArticle->status === 'pending') {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel sedang dalam tahap review dan tidak dapat diedit.',
            ], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'excerpt' => ['sometimes', 'nullable', 'string'],
            'content' => ['sometimes', 'required', 'string'],
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('categories', 'id')],
            'status' => ['sometimes', Rule::in(self::AUTHOR_ALLOWED_STATUSES)],
            'featured_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'featured_image_alt' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tags' => ['sometimes', 'array', 'max:5'],
            'tags.*' => ['string', 'max:50'],
            'meta_title' => ['sometimes', 'nullable', 'string', 'max:70'],
            'meta_description' => ['sometimes', 'nullable', 'string', 'max:160'],
            'og_image' => ['sometimes', 'nullable', 'string', 'max:255'],
            'canonical_url' => ['sometimes', 'nullable', 'url', 'max:255'],
        ]);

        if (empty($validated)) {
            throw ValidationException::withMessages([
                'request' => ['Tidak ada data yang diperbarui.'],
            ]);
        }

        $updates = [];

        $nextTitle = array_key_exists('title', $validated)
            ? ContentSanitizer::sanitizePlainText($validated['title'])
            : (string) $existingArticle->title;

        if (array_key_exists('title', $validated)) {
            $updates['title'] = $nextTitle;
        }

        if (array_key_exists('slug', $validated)) {
            $slugSource = trim((string) ($validated['slug'] ?? $nextTitle));
            $updates['slug'] = $this->makeUniqueSlug($slugSource, $id);
        } elseif (array_key_exists('title', $validated)) {
            $updates['slug'] = $this->makeUniqueSlug($nextTitle, $id);
        }

        if (array_key_exists('excerpt', $validated)) {
            $updates['excerpt'] = filled($validated['excerpt'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['excerpt'])
                : null;
        }

        if (array_key_exists('content', $validated)) {
            $updates['content'] = ContentSanitizer::sanitizeRichText($validated['content']);
        }

        if (array_key_exists('category_id', $validated)) {
            $updates['category_id'] = $validated['category_id'];
        }

        if (array_key_exists('featured_image', $validated)) {
            $featuredImageInput = $validated['featured_image'];
            $featuredImage = ContentSanitizer::sanitizeMediaPath($featuredImageInput);

            if ($featuredImageInput !== null && trim((string) $featuredImageInput) !== '' && $featuredImage === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gambar unggulan tidak valid.',
                ], 422);
            }

            $updates['featured_image'] = $featuredImage;
        }

        if (array_key_exists('featured_image_alt', $validated)) {
            $updates['featured_image_alt'] = filled($validated['featured_image_alt'] ?? null)
                ? ContentSanitizer::sanitizePlainText($validated['featured_image_alt'])
                : null;
        }

        if (array_key_exists('meta_title', $validated)) {
            $updates['meta_title'] = filled($validated['meta_title'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['meta_title']) : null;
        }

        if (array_key_exists('meta_description', $validated)) {
            $updates['meta_description'] = filled($validated['meta_description'] ?? null) ? ContentSanitizer::sanitizePlainText($validated['meta_description']) : null;
        }

        if (array_key_exists('og_image', $validated)) {
            $updates['og_image'] = ContentSanitizer::sanitizeMediaPath($validated['og_image']);
        }

        if (array_key_exists('canonical_url', $validated)) {
            $updates['canonical_url'] = filled($validated['canonical_url'] ?? null) ? trim((string) $validated['canonical_url']) : null;
        }

        if (array_key_exists('status', $validated)) {
            if (!$this->canAuthorTransitionTo((string) $existingArticle->status, (string) $validated['status'])) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Transisi status tidak sesuai workflow editorial.',
                ], 422);
            }

            if ($validated['status'] === 'pending' && blank($request->user()->fresh()?->assigned_reviewer_id)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Anda belum memiliki editor penanggung jawab. Hubungi admin untuk assignment editor.',
                ], 422);
            }

            $updates['status'] = $validated['status'];

            if ($validated['status'] === 'pending') {
                // Reset reviewer assignment and notes when author re-submits for review.
                $updates['reviewer_id'] = null;
                $updates['review_notes'] = null;

                $nextTitleForPriority = (string) ($updates['title'] ?? $existingArticle->title);
                $nextExcerptForPriority = $updates['excerpt'] ?? $existingArticle->excerpt;
                $nextContentForPriority = (string) ($updates['content'] ?? $existingArticle->content);
                $nextPriority = $this->calculatePriorityScore($nextTitleForPriority, $nextExcerptForPriority, $nextContentForPriority);

                $updates['priority_score'] = $nextPriority;
                $updates['review_due_at'] = $this->calculateReviewDueAt($nextPriority, now());
            }

            if ($validated['status'] === 'draft') {
                $updates['review_due_at'] = null;
            }
        }

        $updates['updated_at'] = now();

        $hasStatusTransitionInput = array_key_exists('status', $validated);
        $actor = $request->user();
        $actorId = $actor ? (int) $actor->id : null;
        $actorRole = $actor && isset($actor->role) ? (string) $actor->role : null;

        DB::transaction(function () use ($id, $updates, $hasStatusTransitionInput, $existingArticle, $validated, $actorId, $actorRole) {
            DB::table('articles')->where('id', $id)->update($updates);

            if ($hasStatusTransitionInput) {
                EditorialActivityLogger::logTransition(
                    $id,
                    (string) $existingArticle->status,
                    (string) $validated['status'],
                    $actorId,
                    $actorRole,
                    null,
                    $updates['updated_at'] ?? now()
                );
            }
        });

        if (array_key_exists('tags', $validated)) {
            $this->syncArticleTags($id, $validated['tags'] ?? []);
        }

        $updatedArticle = DB::table('articles')->where('id', $id)->first();
        if ($updatedArticle) {
            $source = $hasStatusTransitionInput && ($validated['status'] ?? null) === 'pending' ? 'submit' : 'manual';
            $this->createArticleVersion((object) $updatedArticle, $authorId, $source);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil diperbarui.',
            'data' => [
                'article' => $this->fetchArticleByAuthor($authorId, $id),
            ],
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $authorId = (int) $request->user()->id;
        $article = DB::table('articles')
            ->where('id', $id)
            ->where('author_id', $authorId)
            ->first();

        if (!$article) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel tidak ditemukan.',
            ], 404);
        }

        if (!in_array($article->status, self::AUTHOR_EDITABLE_STATUSES, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Artikel hanya dapat dihapus saat berstatus draft atau revisi.',
            ], 422);
        }

        DB::table('articles')->where('id', $id)->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Artikel berhasil dihapus.',
        ]);
    }

    private function fetchArticleByAuthor(int $authorId, int $articleId): ?array
    {
        $article = DB::table('articles as a')
            ->leftJoin('categories as c', 'c.id', '=', 'a.category_id')
            ->where('a.author_id', $authorId)
            ->where('a.id', $articleId)
            ->first([
                'a.id',
                'a.title',
                'a.slug',
                'a.excerpt',
                'a.content',
                'a.status',
                'a.featured_image',
                'a.featured_image_alt',
                'a.updated_at',
                'a.created_at',
                'a.category_id',
                DB::raw("COALESCE(c.name, '-') as category_name"),
            ]);

        if (!$article) {
            return null;
        }

        return MediaUrl::withFeaturedImageUrl([
            ...$this->mapArticleSummary($article),
            'slug' => $article->slug,
            'excerpt' => $article->excerpt,
            'content' => $article->content,
            'featured_image' => $article->featured_image,
            'featured_image_alt' => $article->featured_image_alt,
            'category_id' => $article->category_id ? (int) $article->category_id : null,
            'tags' => $this->articleTagNames($articleId),
        ]);
    }

    private function mapArticleSummary(object $article): array
    {
        return [
            'id' => (int) $article->id,
            'title' => $article->title,
            'status' => $article->status,
            'status_label' => $this->statusLabel($article->status),
            'category_name' => $article->category_name,
            'updated_at' => $article->updated_at,
            'created_at' => $article->created_at,
            'can_edit' => in_array($article->status, self::AUTHOR_EDITABLE_STATUSES, true),
        ];
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'Review',
            'revision' => 'Revisi',
            'published' => 'Publikasi',
            'rejected' => 'Ditolak',
            default => 'Draf',
        };
    }

    private function canAuthorTransitionTo(string $currentStatus, string $targetStatus): bool
    {
        return match ($currentStatus) {
            'draft' => in_array($targetStatus, ['draft', 'pending'], true),
            'revision' => in_array($targetStatus, ['draft', 'pending'], true),
            default => false,
        };
    }

    private function makeUniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($source);
        $baseSlug = $baseSlug !== '' ? $baseSlug : 'artikel';
        $slug = $baseSlug;
        $counter = 2;

        while (true) {
            $query = DB::table('articles')->where('slug', $slug);

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

    private function makeUniqueCategorySlug(string $source): string
    {
        $baseSlug = Str::slug($source);
        $baseSlug = $baseSlug !== '' ? $baseSlug : 'kategori';
        $slug = $baseSlug;
        $counter = 2;

        while (DB::table('categories')->where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$counter;
            $counter += 1;
        }

        return $slug;
    }

    private function calculatePriorityScore(string $title, ?string $excerpt, string $content): int
    {
        $score = 50;

        $titleLength = mb_strlen(trim($title));
        $excerptLength = mb_strlen(trim((string) ($excerpt ?? '')));
        $cleanContent = trim(strip_tags($content));
        $contentLength = mb_strlen($cleanContent);

        if ($titleLength >= 24) {
            $score += 5;
        }

        if ($excerptLength >= 120) {
            $score += 5;
        }

        if ($contentLength >= 1200) {
            $score += 15;
        } elseif ($contentLength >= 700) {
            $score += 8;
        } elseif ($contentLength < 350) {
            $score -= 10;
        }

        return max(1, min(100, $score));
    }

    private function calculateReviewDueAt(int $priorityScore, DateTimeInterface $submittedAt): Carbon
    {
        $base = Carbon::instance($submittedAt);

        if ($priorityScore >= 80) {
            return $base->copy()->addHours(8);
        }

        if ($priorityScore >= 60) {
            return $base->copy()->addHours(24);
        }

        return $base->copy()->addHours(48);
    }

    private function createArticleVersion(object $article, int $authorId, string $source): void
    {
        DB::table('article_versions')->insert([
            'article_id' => (int) $article->id,
            'author_id' => $authorId,
            'source' => $source,
            'title' => (string) $article->title,
            'slug' => (string) $article->slug,
            'excerpt' => $article->excerpt,
            'content' => (string) $article->content,
            'category_id' => $article->category_id,
            'featured_image' => $article->featured_image,
            'featured_image_alt' => $article->featured_image_alt,
            'snapshot_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function compressAndStoreMedia(UploadedFile $file, int $authorId, string $checksum): array
    {
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeBaseName = Str::slug((string) $originalName);
        $safeBaseName = $safeBaseName !== '' ? $safeBaseName : 'media';
        $targetDirectory = 'media/'.$authorId.'/'.now()->format('Y/m');

        $imageInfo = @getimagesize($file->getRealPath());
        $width = is_array($imageInfo) && isset($imageInfo[0]) ? (int) $imageInfo[0] : null;
        $height = is_array($imageInfo) && isset($imageInfo[1]) ? (int) $imageInfo[1] : null;
        $imageType = is_array($imageInfo) && isset($imageInfo[2]) ? (int) $imageInfo[2] : null;

        $binary = @file_get_contents($file->getRealPath());
        $binary = $binary === false ? '' : $binary;
        $mimeType = $file->getClientMimeType() ?: 'application/octet-stream';
        $fileExtension = strtolower((string) $file->getClientOriginalExtension());

        $compressedBinary = null;
        if (extension_loaded('gd') && function_exists('imagewebp')) {
            $imageResource = match ($imageType) {
                IMAGETYPE_JPEG => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($file->getRealPath()) : false,
                IMAGETYPE_PNG => function_exists('imagecreatefrompng') ? @imagecreatefrompng($file->getRealPath()) : false,
                IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file->getRealPath()) : false,
                default => false,
            };

            if ($imageResource) {
                if (function_exists('imagepalettetotruecolor')) {
                    @imagepalettetotruecolor($imageResource);
                }
                @imagealphablending($imageResource, true);
                @imagesavealpha($imageResource, true);

                ob_start();
                $encoded = @imagewebp($imageResource, null, 82);
                $webpData = ob_get_clean();
                @imagedestroy($imageResource);

                if ($encoded && is_string($webpData) && $webpData !== '') {
                    $compressedBinary = $webpData;
                }
            }
        }

        $payloadBinary = $compressedBinary ?? $binary;
        $isWebpPayload = $compressedBinary !== null;
        $targetExtension = $isWebpPayload ? 'webp' : ($fileExtension !== '' ? $fileExtension : 'bin');
        $targetName = $safeBaseName.'-'.Str::random(10).'.'.$targetExtension;
        $targetPath = $targetDirectory.'/'.$targetName;

        Storage::disk('public')->put($targetPath, $payloadBinary);

        return [
            'file_name' => $targetName,
            'file_path' => $targetPath,
            'mime_type' => $isWebpPayload ? 'image/webp' : $mimeType,
            'size_bytes' => strlen($payloadBinary),
            'width' => $width,
            'height' => $height,
            'checksum' => $checksum,
        ];
    }

    /**
     * @return list<string>
     */
    private function articleTagNames(int $articleId): array
    {
        return DB::table('article_tag as at')
            ->join('tags as t', 't.id', '=', 'at.tag_id')
            ->where('at.article_id', $articleId)
            ->orderBy('t.name')
            ->pluck('t.name')
            ->map(fn ($name) => (string) $name)
            ->values()
            ->all();
    }

    /**
     * @param  array<int, mixed>  $tagNames
     */
    private function syncArticleTags(int $articleId, array $tagNames): void
    {
        $normalized = collect($tagNames)
            ->map(fn ($name) => ContentSanitizer::sanitizePlainText((string) $name))
            ->filter()
            ->unique()
            ->take(5)
            ->values();

        DB::table('article_tag')->where('article_id', $articleId)->delete();

        foreach ($normalized as $name) {
            $tagId = DB::table('tags')
                ->whereRaw('LOWER(name) = ?', [Str::lower($name)])
                ->value('id');

            if (!$tagId) {
                $baseSlug = Str::slug($name);
                $baseSlug = $baseSlug !== '' ? $baseSlug : 'tag';
                $slug = $baseSlug;
                $counter = 2;

                while (DB::table('tags')->where('slug', $slug)->exists()) {
                    $slug = $baseSlug.'-'.$counter;
                    $counter += 1;
                }

                $tagId = DB::table('tags')->insertGetId([
                    'name' => $name,
                    'slug' => $slug,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('article_tag')->insert([
                'article_id' => $articleId,
                'tag_id' => (int) $tagId,
            ]);
        }
    }
}
