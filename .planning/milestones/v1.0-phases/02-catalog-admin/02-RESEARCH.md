# Phase 2: Catalog + Admin - Research

**Researched:** 2026-03-30
**Domain:** Full-stack catalog/admin CRUD -- Drizzle ORM schema, PostgreSQL FTS, file uploads (R2), NestJS modules, Next.js App Router pages, Swiper carousel, shadcn admin UI
**Confidence:** HIGH

## Summary

Phase 2 transforms the placeholder home page into a fully functional catalog system with genre navigation, performance search, and admin CRUD. The phase spans all layers: DB schema (7+ new tables), NestJS backend (performance, admin, banner modules with RBAC), and Next.js frontend (5+ new pages, 10+ new components).

The core technical challenges are: (1) PostgreSQL tsvector/pg_trgm search with Korean text limitations, (2) file upload flow (poster images, SVG seat maps) via Cloudflare R2 presigned URLs, (3) admin RBAC using NestJS Guards with the existing JWT auth system, and (4) Swiper carousel integration as a client component in Next.js 16 App Router.

**Primary recommendation:** Build bottom-up -- DB schema first (Drizzle migrations), then NestJS API modules (performance CRUD, search, admin with RolesGuard), then frontend pages (genre/detail/search/admin). Use presigned URL pattern for R2 uploads (backend generates URL, browser uploads directly). Reuse existing patterns (ZodValidationPipe, DrizzleModule, apiClient) throughout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Home page: main banner carousel (Swiper) + HOT section (4 cards horizontal scroll) + new section (4 cards) + genre shortcut (icon grid)
- **D-02:** GNB genre tabs: 5 main (musical, concert, play, exhibition, classic) + "more" dropdown for 3 others (sports, kids/family, leisure/camping)
- **D-03:** Banner carousel managed via admin (image + link registration). Included in scope despite not being in ADMN requirements
- **D-04:** Genre category page subcategory filters: top chips ([all][hot][original/visiting] etc). URL searchParams state management
- **D-05:** Performance card: poster (2:3) + status badge + title + venue + dates. No price on card
- **D-06:** Grid: desktop 4-col, tablet 3-col, mobile 2-col responsive
- **D-07:** Traditional numbered pagination. URL searchParams for page state. SEO friendly
- **D-08:** Sort: latest (default) + popular toggle
- **D-09:** Detail top layout: left poster + right info (title, venue, period, age, runtime, tier pricing, booking CTA). Mobile vertical stack
- **D-10:** Booking CTA: sticky in info area + mobile bottom bar. Phase 2 disabled + "coming soon"
- **D-11:** Casting: circle avatar + name + role grid. Admin registers with photo upload
- **D-12:** Detail tabs 3: casting / detail info / sales info
- **D-13:** users table role enum (USER/ADMIN). NestJS Guard for /admin API. Next.js proxy for /admin route check. Initial manual DB admin setup
- **D-14:** Performance form: single page sectioned (basic info / media / price tiers / showtime / casting / seat map). Scroll through
- **D-15:** SVG seat map: file upload -> preview -> tier group select -> color/price assignment. data-seat-id attribute for seat identification
- **D-16:** Admin performance list: table + status filter + search. Row click -> edit page
- **D-17:** Admin banner management: image upload + link URL + display order management

### Claude's Discretion
- Admin layout structure (sidebar nav vs top tabs) -- **resolved in UI-SPEC: sidebar 240px**
- Search results page layout (card grid reuse vs separate design) -- **resolved: reuse card grid**
- Search autocomplete (SRCH-01 requires keyword only) -- **resolved: no autocomplete in Phase 2**
- Ended shows toggle UI (SRCH-03) -- **resolved: shadcn Switch component**
- Performance status logic -- **resolved: date-based automatic (start > now = coming, start <= now <= end = selling, end < now = ended, ended - 7d = closing soon)**
- Poster image optimization -- **resolved: Next.js Image + R2 CDN URL**

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Genre category browsing (8 genres) | DB: genres table with slug. API: GET /api/v1/performances?genre=. Frontend: /genre/:genre route with GNB tab activation |
| PERF-02 | Subcategory filtering | DB: performances.subcategory or tags column. Frontend: chip UI with URL searchParams |
| PERF-03 | Detail page (poster, venue, dates, runtime, age, tier pricing) | DB: performances + venues + price_tiers tables. API: GET /api/v1/performances/:id. Frontend: /performance/:id route |
| PERF-04 | Casting information | DB: castings table. API: GET /api/v1/performances/:id/castings. Frontend: casting tab with avatar grid |
| PERF-05 | Card-type paginated list | Frontend: PerformanceCard component + PaginationNav. API: cursor/offset pagination with total count |
| SRCH-01 | Keyword search by performance name | DB: tsvector + pg_trgm indexes. API: GET /api/v1/search?q=. Frontend: /search route |
| SRCH-02 | Genre filter on search results | API: GET /api/v1/search?q=&genre=. Frontend: genre chips on search page |
| SRCH-03 | Ended shows include/exclude toggle | API: GET /api/v1/search?q=&ended=true. Frontend: Switch component |
| ADMN-01 | Performance CRUD | DB: full schema. API: POST/PUT/DELETE /api/v1/admin/performances. Frontend: admin form page |
| ADMN-02 | Showtime CRUD | DB: showtimes table. API: CRUD /api/v1/admin/performances/:id/showtimes. Frontend: showtime section in form |
| ADMN-03 | SVG seat map upload + tier/price config | DB: seat_maps table with svg_url + seat_config JSON. API: presigned URL + config save. Frontend: SVG preview + tier editor |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- ES modules (import/export), not CommonJS
- Functional patterns preferred; classes only for external interfaces (NestJS uses classes by convention)
- Strict typing -- no `any`, no untyped variables
- Run typecheck after code changes
- Run lint after code changes; fix errors always, warnings only in changed code
- Write tests before implementation for business logic and API code
- Run existing tests after changes
- No Co-Authored-By trailers in commits
- Conventional commits (feat:, fix:, test:, refactor:, docs:)
- Tech stack: docs/03-ARCHITECTURE.md defines the stack (Drizzle ORM, zod, React Query, Zustand, etc.)
- Monorepo: pnpm workspaces + Turborepo
- Environment: Node.js >= 22, TypeScript ~5.9
- .env at monorepo root only

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| drizzle-orm | 0.45.2 | DB schema + queries | Installed in apps/api |
| drizzle-kit | 0.31.x | Migrations | Installed in apps/api devDeps |
| zod | 3.25.x | Validation (frontend + backend) | Installed in apps/api |
| react-hook-form | 7.72.0 | Admin form management | Installed in apps/web |
| @hookform/resolvers | 5.2.2 | Zod resolver for RHF | Installed in apps/web |
| lucide-react | 1.7.x | Icons | Installed in apps/web |
| next | 16.2.x | Frontend framework | Installed |
| @nestjs/core | 11.1.x | Backend framework | Installed |

### New Dependencies Required

| Library | Version | Purpose | Install Target |
|---------|---------|---------|---------------|
| swiper | 12.1.3 | Banner carousel + HOT card slider | apps/web |
| @tanstack/react-query | 5.95.2 | Server state management | apps/web |
| @aws-sdk/client-s3 | 3.x (latest) | R2 file upload (PutObject, presigned URLs) | apps/api |
| @aws-sdk/s3-request-presigner | 3.x (latest) | Generate presigned upload URLs | apps/api |
| drizzle-zod | 0.8.3 | Auto-generate zod schemas from Drizzle tables | apps/api |
| sharp | latest (0.34.x) | Image optimization for Next.js standalone | apps/web |

### shadcn Components to Install

| Component | shadcn Name | Usage |
|-----------|-------------|-------|
| Card | card | Performance cards, admin data cards |
| Select | select | Genre filter, sort, admin dropdowns |
| DropdownMenu | dropdown-menu | GNB "more genres" dropdown |
| Table | table | Admin lists |
| AlertDialog | alert-dialog | Destructive action confirmations |
| Badge | badge | Performance status badges |
| Textarea | textarea | Admin description input |
| Skeleton | skeleton | Loading states |
| Sheet | sheet | Mobile filter panel |
| Tooltip | tooltip | Admin action icons |
| Switch | switch | Ended shows toggle |

**Installation commands:**

```bash
# New npm packages
pnpm --filter @grapit/web add swiper@^12.1.3 @tanstack/react-query@^5.95.0 sharp
pnpm --filter @grapit/api add @aws-sdk/client-s3@^3 @aws-sdk/s3-request-presigner@^3 drizzle-zod@^0.8.3

# shadcn components (run from apps/web)
cd apps/web && npx shadcn@latest add card select dropdown-menu table alert-dialog badge textarea skeleton sheet tooltip switch
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Presigned URL upload | Proxy upload through NestJS | Presigned URL avoids server bandwidth bottleneck; proxy is simpler but server-bound |
| drizzle-zod | Manual zod schemas | drizzle-zod eliminates schema duplication but adds a dependency |
| Swiper | Embla Carousel | Swiper has richer features (autoplay, pagination dots, loop), Embla is lighter but needs more DIY |

## Architecture Patterns

### Recommended Project Structure (New Files)

```
apps/api/src/
├── database/schema/
│   ├── performances.ts       # performances, genres, subcategories tables
│   ├── showtimes.ts          # showtimes table
│   ├── venues.ts             # venues table
│   ├── seat-maps.ts          # seat_maps, seats tables
│   ├── castings.ts           # castings table
│   ├── banners.ts            # banners table
│   ├── price-tiers.ts        # price_tiers table
│   └── index.ts              # re-export all (update existing)
├── common/
│   ├── decorators/
│   │   └── roles.decorator.ts    # @Roles('ADMIN') decorator
│   └── guards/
│       └── roles.guard.ts        # RolesGuard (check user.role)
├── modules/
│   ├── performance/
│   │   ├── performance.module.ts
│   │   ├── performance.controller.ts   # Public catalog APIs
│   │   ├── performance.service.ts
│   │   └── dto/
│   │       └── performance.dto.ts      # Zod schemas for query/response
│   ├── search/
│   │   ├── search.module.ts
│   │   ├── search.controller.ts        # GET /api/v1/search
│   │   ├── search.service.ts           # tsvector + pg_trgm logic
│   │   └── dto/
│   │       └── search.dto.ts
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── admin-performance.controller.ts  # CRUD performances
│   │   ├── admin-banner.controller.ts       # CRUD banners
│   │   ├── admin.service.ts
│   │   ├── upload.service.ts                # R2 presigned URL generation
│   │   └── dto/
│   │       ├── create-performance.dto.ts
│   │       ├── update-performance.dto.ts
│   │       └── banner.dto.ts

apps/web/
├── app/
│   ├── page.tsx                    # Home (replace placeholder)
│   ├── genre/
│   │   └── [genre]/
│   │       └── page.tsx            # Genre category page
│   ├── performance/
│   │   └── [id]/
│   │       └── page.tsx            # Performance detail
│   ├── search/
│   │   └── page.tsx                # Search results
│   ├── admin/
│   │   ├── layout.tsx              # Admin layout (sidebar)
│   │   ├── performances/
│   │   │   ├── page.tsx            # Performance list
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # Create performance
│   │   │   └── [id]/
│   │   │       └── edit/
│   │   │           └── page.tsx    # Edit performance
│   │   └── banners/
│   │       └── page.tsx            # Banner management
│   └── proxy.ts                    # Admin route protection (was middleware.ts in older Next.js)
├── components/
│   ├── performance/
│   │   ├── performance-card.tsx
│   │   ├── performance-grid.tsx
│   │   ├── genre-chip.tsx
│   │   ├── status-badge.tsx
│   │   ├── pagination-nav.tsx
│   │   └── sort-toggle.tsx
│   ├── home/
│   │   ├── banner-carousel.tsx
│   │   ├── hot-section.tsx
│   │   ├── new-section.tsx
│   │   └── genre-grid.tsx
│   ├── search/
│   │   ├── search-bar.tsx
│   │   └── search-results.tsx
│   └── admin/
│       ├── admin-sidebar.tsx
│       ├── performance-form.tsx
│       ├── showtime-manager.tsx
│       ├── casting-manager.tsx
│       ├── svg-preview.tsx
│       ├── tier-editor.tsx
│       ├── banner-manager.tsx
│       └── status-filter.tsx
├── hooks/
│   ├── use-performances.ts         # React Query hooks
│   ├── use-search.ts
│   └── use-admin.ts
└── lib/
    └── api-client.ts               # Extend with PUT + multipart support
```

### Pattern 1: NestJS Module with Drizzle (Follow Existing Auth Pattern)

**What:** Each feature domain gets a NestJS module with controller/service/dto, injecting DRIZZLE symbol for DB access.
**When to use:** All new backend modules in this phase.

```typescript
// Source: Existing pattern in apps/api/src/modules/auth/
import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller.js';
import { PerformanceService } from './performance.service.js';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}

// Service pattern -- inject DRIZZLE symbol
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import { performances } from '../../database/schema/index.js';
import { eq, desc, and, sql } from 'drizzle-orm';

@Injectable()
export class PerformanceService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByGenre(genreSlug: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    return this.db
      .select()
      .from(performances)
      .where(eq(performances.genreSlug, genreSlug))
      .orderBy(desc(performances.createdAt))
      .limit(limit)
      .offset(offset);
  }
}
```

### Pattern 2: RolesGuard for Admin RBAC

**What:** Custom guard that checks user.role against required roles metadata.
**When to use:** All /admin API endpoints.

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// Usage in controller
@Controller('admin/performances')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminPerformanceController { ... }
```

### Pattern 3: R2 Presigned URL Upload Flow

**What:** Backend generates presigned URL, browser uploads directly to R2, backend stores the resulting URL.
**When to use:** Poster images, cast photos, banner images, SVG seat maps.

```typescript
// upload.service.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: config.get('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async generatePresignedUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.get('R2_BUCKET_NAME'),
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 600 });
  }
}

// Frontend upload flow:
// 1. POST /api/v1/admin/upload/presigned -> { url, key }
// 2. PUT {presignedUrl} with file body from browser
// 3. Save R2 public URL in performance record
```

### Pattern 4: PostgreSQL Full-Text Search with Drizzle

**What:** tsvector generated column + GIN index for keyword search, pg_trgm for fuzzy matching.
**When to use:** SRCH-01, SRCH-02, SRCH-03.

```typescript
// Schema: performances table with search_vector generated column
import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const performances = pgTable('performances', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  // ... other fields
  // Note: search_vector is defined as a GENERATED column via raw SQL migration
  // Drizzle does not natively support tsvector type
}, (table) => [
  index('idx_performances_search').using('gin', sql`search_vector`),
  index('idx_performances_title_trgm').using('gin', sql`${table.title} gin_trgm_ops`),
]);

// Search service query
async search(query: string, genre?: string, includeEnded?: boolean) {
  const conditions = [
    sql`(
      search_vector @@ plainto_tsquery('simple', ${query})
      OR ${performances.title} ILIKE ${'%' + query + '%'}
    )`,
  ];
  if (genre) conditions.push(eq(performances.genreSlug, genre));
  if (!includeEnded) conditions.push(sql`${performances.status} != 'ended'`);

  return this.db
    .select()
    .from(performances)
    .where(and(...conditions))
    .orderBy(sql`ts_rank(search_vector, plainto_tsquery('simple', ${query})) DESC`);
}
```

### Pattern 5: React Query + URL SearchParams (Frontend Data Fetching)

**What:** React Query for server state with URL searchParams as the source of truth for filters/pagination.
**When to use:** Genre page, search page, admin list.

```typescript
// hooks/use-performances.ts
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export function usePerformances(genre: string) {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const sort = searchParams.get('sort') ?? 'latest';
  const sub = searchParams.get('sub') ?? '';

  return useQuery({
    queryKey: ['performances', genre, page, sort, sub],
    queryFn: () => apiClient.get<PerformanceListResponse>(
      `/api/v1/performances?genre=${genre}&page=${page}&sort=${sort}&sub=${sub}`
    ),
  });
}
```

### Pattern 6: Swiper as Client Component

**What:** Swiper carousel wrapped in 'use client' component.
**When to use:** Home banner carousel, HOT card horizontal scroll.

```typescript
// components/home/banner-carousel.tsx
'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

interface BannerSlide {
  id: string;
  imageUrl: string;
  linkUrl: string;
}

export function BannerCarousel({ banners }: { banners: BannerSlide[] }) {
  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      loop={banners.length > 1}
      className="h-[400px] md:h-[200px]"
    >
      {banners.map((banner) => (
        <SwiperSlide key={banner.id}>
          <a href={banner.linkUrl}>
            <img src={banner.imageUrl} alt="프로모션 배너" className="h-full w-full object-cover" />
          </a>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
```

### Anti-Patterns to Avoid
- **Proxy uploads through NestJS:** Do not route file bytes through the NestJS server. Use presigned URLs so the browser uploads directly to R2. This avoids memory/bandwidth bottleneck on a Cloud Run instance.
- **Separate Drizzle provider per module:** The DrizzleModule is already @Global(). Do not create module-specific DB providers -- inject the DRIZZLE symbol directly.
- **Mixing URL state and Zustand:** Filters, pagination, and sort should live in URL searchParams (SEO-friendly, shareable). Only booking flow state belongs in Zustand.
- **Installing drizzle-zod on frontend:** drizzle-zod depends on drizzle-orm internals. Keep it backend-only. Share validation schemas through @grapit/shared package.
- **Using `output: 'export'` in Next.js for admin:** Admin routes need dynamic data. Keep `output: 'standalone'` as configured.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination component | Custom pagination logic | Offset + total count from API, PaginationNav component | Edge cases: first/last disable, ellipsis logic, URL sync |
| File upload UI | Custom drag-and-drop | HTML5 drag-and-drop with drop zone div | Simple enough natively; no library needed for single-file |
| Form state management | useState per field | react-hook-form + zod resolver | 15+ fields in performance form; uncontrolled approach minimizes re-renders |
| Admin table sorting/filtering | Custom table state | Server-side sorting via API query params | Data lives in DB; client-sort only works for single pages |
| Image optimization | Custom resize/convert | Next.js Image component | Built-in WebP conversion, srcSet, lazy loading |
| Status badge styling | Manual conditional classes | Badge variant map (status -> color) | Consistent across card, detail, admin table |
| Korean text search | Custom tokenizer | PostgreSQL pg_trgm + ILIKE fallback | tsvector 'simple' parser does not do Korean morphological analysis; pg_trgm trigrams + ILIKE provide adequate partial matching for <100k records |

**Key insight:** The admin form is the most complex UI component (15+ fields across 6 sections). react-hook-form with nested field arrays (price tiers, showtimes, castings) handles this elegantly with minimal re-renders. Do not try to manage this with useState.

## Common Pitfalls

### Pitfall 1: Korean Text Search with tsvector 'simple' Parser
**What goes wrong:** `plainto_tsquery('simple', '뮤지컬')` does not tokenize Korean words properly. Searching for partial terms like "뮤지" won't match "뮤지컬" via tsvector alone.
**Why it happens:** PostgreSQL's `simple` parser splits on whitespace only. It treats the entire Korean word as one token. No morphological analysis. pg_trgm also has limitations with non-ASCII characters in older PostgreSQL versions.
**How to avoid:** Combine tsvector search with ILIKE fallback: `WHERE search_vector @@ query OR title ILIKE '%keyword%'`. The ILIKE with a B-tree index on title provides substring matching. For <100k records, this dual approach is performant enough.
**Warning signs:** Search returns zero results for partial Korean terms that clearly should match.

### Pitfall 2: Drizzle Schema Symbol Import After Adding New Tables
**What goes wrong:** New schema tables not reflected in the DrizzleDB type or query builder after adding schema files.
**Why it happens:** The drizzle provider imports `* as schema from './schema/index.js'`. If new schema files are not re-exported from index.ts, the DrizzleDB type won't include them. Also, `drizzle-kit generate` needs the schema index to include all tables.
**How to avoid:** Always update `apps/api/src/database/schema/index.ts` to re-export new table definitions. Run `drizzle-kit generate` after schema changes. The DrizzleDB type automatically picks up all exported schemas.
**Warning signs:** TypeScript errors when trying to use `db.query.performances` or `db.select().from(performances)`.

### Pitfall 3: Swiper CSS Missing in Next.js App Router
**What goes wrong:** Swiper renders but has no styling -- slides stack vertically instead of horizontally.
**Why it happens:** Swiper v12 uses CSS-first theming. The CSS imports (`swiper/css`, `swiper/css/pagination`) must be imported in the client component file. In App Router, these imports work in client components but may cause issues if imported in server components.
**How to avoid:** Always import Swiper CSS in the same `'use client'` component file that uses `<Swiper>`. Do not import Swiper CSS in layout.tsx or globals.css.
**Warning signs:** Swiper container renders at 0 height or slides are not in a row.

### Pitfall 4: apiClient Missing PUT and Multipart Support
**What goes wrong:** The existing apiClient only supports GET, POST, PATCH, DELETE with JSON body. No PUT method, no multipart/form-data support.
**Why it happens:** Phase 1 only needed JSON APIs. R2 presigned URL uploads require PUT with binary body directly to R2 (not through apiClient), but the admin API needs PUT for update operations.
**How to avoid:** Add `put` method to apiClient. For R2 presigned uploads, use native `fetch()` directly (not apiClient) since the upload goes to R2's domain, not the API server.
**Warning signs:** 405 Method Not Allowed on update operations.

### Pitfall 5: Admin Route Protection Leaking on Client Navigation
**What goes wrong:** User navigates to /admin from a non-admin account and sees the page briefly before redirect.
**Why it happens:** Next.js proxy/middleware runs on server requests but client-side navigation via `<Link>` may bypass it. The page component renders before the redirect fires.
**How to avoid:** Two-layer protection: (1) Next.js proxy.ts (or middleware.ts) checks the user's role cookie/token on server-side requests, (2) Admin layout component also checks auth state and redirects on client side. API endpoints are independently protected by NestJS RolesGuard.
**Warning signs:** Flash of admin content for non-admin users.

### Pitfall 6: drizzle-kit migrate Fails to Find .env
**What goes wrong:** Migration commands fail with "DATABASE_URL not found".
**Why it happens:** drizzle-kit reads from `process.cwd()`, but when run via `pnpm --filter @grapit/api exec`, the cwd changes to `apps/api/`. The .env file is at monorepo root.
**How to avoid:** Always use `DOTENV_CONFIG_PATH=../../.env` prefix as documented in CLAUDE.md conventions.
**Warning signs:** "url is required" error from drizzle-kit.

### Pitfall 7: R2 CORS Not Configured for Browser Uploads
**What goes wrong:** Presigned URL works in Postman/curl but fails from browser with CORS error.
**Why it happens:** R2 buckets need explicit CORS rules to allow browser PUT requests from your domain.
**How to avoid:** Configure R2 bucket CORS rules in Cloudflare dashboard to allow PUT from your domain origins (`http://localhost:3000`, production domain). Include `Content-Type` in allowed headers.
**Warning signs:** Browser console shows "Access-Control-Allow-Origin" error on presigned URL PUT.

## Code Examples

### Drizzle Schema: performances table

```typescript
// Source: Architecture patterns from docs/03-ARCHITECTURE.md ERD + Drizzle ORM docs
import { pgTable, uuid, varchar, text, date, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const performanceStatusEnum = pgEnum('performance_status', [
  'draft', 'upcoming', 'selling', 'closing_soon', 'ended'
]);

export const genreEnum = pgEnum('genre_slug', [
  'musical', 'concert', 'play', 'exhibition', 'classic',
  'sports', 'kids_family', 'leisure_camping'
]);

export const performances = pgTable('performances', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  genreSlug: genreEnum('genre_slug').notNull(),
  venueName: varchar('venue_name', { length: 255 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  durationMinutes: integer('duration_minutes'),
  ageRestriction: varchar('age_restriction', { length: 50 }),
  description: text('description'),
  posterUrl: varchar('poster_url', { length: 500 }),
  status: performanceStatusEnum('status').notNull().default('draft'),
  subcategory: varchar('subcategory', { length: 50 }),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_perf_genre_status').on(table.genreSlug, table.status),
  index('idx_perf_created').on(table.createdAt),
]);

// Note: search_vector GENERATED column and GIN indexes are created via raw SQL migration
// because Drizzle ORM does not natively support tsvector type
```

### Drizzle Schema: supporting tables

```typescript
// showtimes.ts
export const showtimes = pgTable('showtimes', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  showDate: date('show_date').notNull(),
  showTime: varchar('show_time', { length: 10 }).notNull(), // "19:30"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_showtime_perf').on(table.performanceId),
]);

// price_tiers.ts
export const priceTiers = pgTable('price_tiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  tierName: varchar('tier_name', { length: 50 }).notNull(), // "VIP", "R", "S", "A"
  price: integer('price').notNull(), // in KRW
  color: varchar('color', { length: 7 }), // "#FF0000" for SVG tier coloring
  sortOrder: integer('sort_order').notNull().default(0),
});

// castings.ts
export const castings = pgTable('castings', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  actorName: varchar('actor_name', { length: 100 }).notNull(),
  roleName: varchar('role_name', { length: 100 }),
  profileImageUrl: varchar('profile_image_url', { length: 500 }),
});

// banners.ts
export const banners = pgTable('banners', {
  id: uuid('id').defaultRandom().primaryKey(),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  linkUrl: varchar('link_url', { length: 500 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// seat_maps.ts
export const seatMaps = pgTable('seat_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  svgUrl: varchar('svg_url', { length: 500 }).notNull(),
  seatConfig: jsonb('seat_config'), // JSON: tier-to-seat-group mapping with colors and prices
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Raw SQL Migration for tsvector + pg_trgm

```sql
-- Must be added as a custom SQL migration after drizzle-kit generate
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE performances ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_performances_search
  ON performances USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_performances_title_trgm
  ON performances USING GIN (title gin_trgm_ops);
```

### React Query Provider Setup

```typescript
// apps/web/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// apps/web/app/layout.tsx -- wrap children with <Providers>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js middleware.ts | Next.js 16: proxy.ts (renamed) | Oct 2025 (Next.js 16) | Function renamed from `middleware` to `proxy`, file renamed from `middleware.ts` to `proxy.ts` |
| Swiper SCSS theming | Swiper v12: CSS-first theming (no SCSS/LESS) | Sep 2025 | Import `swiper/css` instead of `swiper/scss`; element-based API recommended |
| class-validator DTOs | drizzle-zod auto-generated schemas | 2025 | Single source of truth from DB schema; eliminates DTO class duplication |
| drizzle-zod 0.5.x API | drizzle-zod 0.8.x: `createInsertSchema`, `createSelectSchema` | 2025 | More stable API, better handling of nullable fields and defaults |

**Deprecated/outdated:**
- `@tosspayments/sdk`: Use `@tosspayments/tosspayments-sdk` (not relevant for Phase 2 but noted)
- Swiper SCSS imports: Use CSS imports only in v12
- Next.js `middleware.ts`: Renamed to `proxy.ts` in Next.js 16

## Open Questions

1. **R2 bucket and credentials availability**
   - What we know: CLAUDE.md specifies Cloudflare R2 for object storage. @aws-sdk/client-s3 is the recommended SDK.
   - What's unclear: Whether R2 bucket, API credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY), and CORS rules are already configured.
   - Recommendation: Plan should include a task to verify R2 setup or mock file uploads with local storage fallback during development. Store uploaded file URLs as R2 public URLs (via Cloudflare CDN custom domain) or R2 dev URLs.

2. **Next.js 16 proxy.ts vs middleware.ts naming**
   - What we know: Next.js 16 renamed middleware.ts to proxy.ts. However, the project has Next.js ^16.2.0 installed.
   - What's unclear: Whether the current Next.js 16.2 version enforces the rename or still supports both.
   - Recommendation: Check which name the project's Next.js version expects. If proxy.ts is required, use it. Otherwise, middleware.ts still works for backward compatibility.

3. **Genre data seeding**
   - What we know: 8 genres are defined (D-02). They could be an enum in the DB or a seeded reference table.
   - What's unclear: Whether to use pgEnum (simpler, no join) or a genres table (more flexible, allows future additions).
   - Recommendation: Use pgEnum for genre_slug (simpler, matches the fixed set of 8 genres). If flexibility is needed later, migration is straightforward.

4. **Subcategory definitions per genre**
   - What we know: D-04 mentions subcategories like "요즘HOT", "오리지널/내한" etc. These vary by genre.
   - What's unclear: The exact subcategory list per genre.
   - Recommendation: Store subcategories as a varchar column on performances. Define the mapping (genre -> available subcategories) as a constant in @grapit/shared. This avoids a separate table for a simple tagging feature.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | >= 22 (per engines) | -- |
| pnpm | Package management | Yes | 10.28.1 | -- |
| PostgreSQL | DB schema + search | Remote (Cloud SQL) | 16 | Local pg via Docker for dev |
| Cloudflare R2 | File uploads | Unknown | -- | Local file system mock or MinIO for dev |
| Turbo | Build orchestration | Yes | 2.8.x | -- |

**Missing dependencies with no fallback:**
- None identified -- all core dependencies are available or have dev fallbacks.

**Missing dependencies with fallback:**
- Cloudflare R2: If not configured yet, mock file uploads with local file storage during development. Plan should include R2 setup verification task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.x |
| Config file (API) | `apps/api/vitest.config.ts` |
| Config file (Web) | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/api test` or `pnpm --filter @grapit/web test` |
| Full suite command | `pnpm test` (runs via Turborepo) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Genre-based performance listing | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/performance.service.spec.ts -t "findByGenre"` | Wave 0 |
| PERF-02 | Subcategory filtering | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/performance.service.spec.ts -t "subcategory"` | Wave 0 |
| PERF-03 | Performance detail response shape | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/performance.service.spec.ts -t "findById"` | Wave 0 |
| PERF-04 | Casting data retrieval | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/performance.service.spec.ts -t "castings"` | Wave 0 |
| PERF-05 | Pagination (offset + total count) | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/performance.service.spec.ts -t "pagination"` | Wave 0 |
| SRCH-01 | Keyword search returns matches | unit | `pnpm --filter @grapit/api exec vitest run src/modules/search/search.service.spec.ts -t "keyword"` | Wave 0 |
| SRCH-02 | Genre filter on search | unit | `pnpm --filter @grapit/api exec vitest run src/modules/search/search.service.spec.ts -t "genre filter"` | Wave 0 |
| SRCH-03 | Ended shows toggle | unit | `pnpm --filter @grapit/api exec vitest run src/modules/search/search.service.spec.ts -t "ended"` | Wave 0 |
| ADMN-01 | Performance CRUD operations | unit | `pnpm --filter @grapit/api exec vitest run src/modules/admin/admin.service.spec.ts -t "performance"` | Wave 0 |
| ADMN-02 | Showtime CRUD | unit | `pnpm --filter @grapit/api exec vitest run src/modules/admin/admin.service.spec.ts -t "showtime"` | Wave 0 |
| ADMN-03 | Upload presigned URL + seat config save | unit | `pnpm --filter @grapit/api exec vitest run src/modules/admin/upload.service.spec.ts` | Wave 0 |
| D-13 | RolesGuard blocks non-admin | unit | `pnpm --filter @grapit/api exec vitest run src/common/guards/roles.guard.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/api test` (API) or `pnpm --filter @grapit/web test` (Web)
- **Per wave merge:** `pnpm test` (full suite via Turbo)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/performance/performance.service.spec.ts` -- covers PERF-01 through PERF-05
- [ ] `apps/api/src/modules/search/search.service.spec.ts` -- covers SRCH-01 through SRCH-03
- [ ] `apps/api/src/modules/admin/admin.service.spec.ts` -- covers ADMN-01, ADMN-02
- [ ] `apps/api/src/modules/admin/upload.service.spec.ts` -- covers ADMN-03
- [ ] `apps/api/src/common/guards/roles.guard.spec.ts` -- covers D-13 admin authorization

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/src/database/schema/`, `apps/api/src/modules/auth/`, `apps/web/components/`, `apps/web/lib/api-client.ts` -- established patterns
- `docs/03-ARCHITECTURE.md` -- ERD, API endpoints, DB schema design, search strategy
- `docs/05-ADMIN-PREDICTION.md` -- Admin feature reverse-engineering
- `02-CONTEXT.md` -- All locked decisions D-01 through D-17
- `02-UI-SPEC.md` -- UI design contract, component inventory, interaction contracts
- npm registry -- verified current package versions (drizzle-orm 0.45.2, swiper 12.1.3, @tanstack/react-query 5.95.2, drizzle-zod 0.8.3)

### Secondary (MEDIUM confidence)
- [Drizzle ORM PostgreSQL FTS guide](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) -- tsvector patterns
- [Drizzle ORM Generated Columns](https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns) -- generated column for search_vector
- [drizzle-zod docs](https://orm.drizzle.team/docs/zod) -- createInsertSchema / createSelectSchema API
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- presigned URL pattern
- [Cloudflare R2 Upload docs](https://developers.cloudflare.com/r2/objects/upload-objects/) -- S3-compatible upload
- [Swiper React docs](https://swiperjs.com/react) -- React component API
- [NestJS RBAC custom guard pattern](https://dev.to/imzihad21/custom-role-based-access-control-in-nestjs-using-custom-guards-jol) -- RolesGuard pattern
- [NestJS + Drizzle integration (Trilon)](https://trilon.io/blog/nestjs-drizzleorm-a-great-match) -- module pattern

### Tertiary (LOW confidence)
- Next.js 16 proxy.ts rename -- mentioned in search results but needs verification against actual installed version behavior
- pg_trgm Korean text support -- search results suggest limitations with non-ASCII; ILIKE fallback is the pragmatic solution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are already specified in CLAUDE.md, versions verified against npm registry
- Architecture: HIGH -- follows existing codebase patterns (auth module, drizzle provider, zod DTOs) and documented architecture (03-ARCHITECTURE.md)
- Pitfalls: HIGH -- Korean search, Swiper CSS, R2 CORS are well-documented issues with verified solutions
- DB Schema: MEDIUM -- based on architecture ERD but actual column details need validation during implementation
- Next.js 16 proxy.ts: LOW -- needs verification whether the rename is enforced or optional

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (30 days -- stable ecosystem, no imminent breaking changes)
