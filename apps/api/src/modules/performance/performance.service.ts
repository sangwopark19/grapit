import { Inject, Injectable } from '@nestjs/common';
import { eq, desc, sql, and, inArray, ne } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import {
  performances,
  venues,
  priceTiers,
  showtimes,
  castings,
  seatMaps,
  banners,
} from '../../database/schema/index.js';
import type {
  PerformanceCardData,
  PerformanceListResponse,
  PerformanceWithDetails,
  Banner,
  PerformanceQuery,
} from '@grapit/shared';
import { CacheService } from './cache.service.js';

@Injectable()
export class PerformanceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async findByGenre(
    genre: string,
    query: PerformanceQuery,
  ): Promise<PerformanceListResponse> {
    const { page = 1, limit = 20, sort = 'latest', ended = false, sub } = query;

    const cacheKey = `cache:performances:list:${genre}:${page}:${limit}:${sort}:${ended}:${sub ?? 'none'}`;
    const cached = await this.cacheService.get<PerformanceListResponse>(cacheKey);
    if (cached) return cached;

    const offset = (page - 1) * limit;

    const conditions = [eq(performances.genre, genre as typeof performances.genre.enumValues[number])];

    if (sub) {
      conditions.push(eq(performances.subcategory, sub));
    }

    if (!ended) {
      conditions.push(ne(performances.status, 'ended'));
    }

    const whereClause = and(...conditions);

    const orderByClause = sort === 'popular'
      ? desc(performances.viewCount)
      : desc(performances.createdAt);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          id: performances.id,
          title: performances.title,
          genre: performances.genre,
          posterUrl: performances.posterUrl,
          status: performances.status,
          startDate: performances.startDate,
          endDate: performances.endDate,
          venueName: venues.name,
        })
        .from(performances)
        .leftJoin(venues, eq(performances.venueId, venues.id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(performances)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    const result: PerformanceListResponse = {
      data: data.map((row) => ({
        id: row.id,
        title: row.title,
        genre: row.genre,
        posterUrl: row.posterUrl,
        status: row.status,
        startDate: row.startDate?.toISOString() ?? '',
        endDate: row.endDate?.toISOString() ?? '',
        venueName: row.venueName ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async findById(id: string): Promise<PerformanceWithDetails | null> {
    // Increment view count BEFORE the cache check so view counters keep
    // accruing on every request, not just on DB hits (per plan acceptance).
    // no-op if ID doesn't exist.
    await this.db
      .update(performances)
      .set({ viewCount: sql`${performances.viewCount} + 1` })
      .where(eq(performances.id, id));

    const cacheKey = `cache:performances:detail:${id}`;
    const cached = await this.cacheService.get<PerformanceWithDetails>(cacheKey);
    if (cached) return cached;

    // Get performance with venue
    const [performanceRow] = await this.db
      .select()
      .from(performances)
      .leftJoin(venues, eq(performances.venueId, venues.id))
      .where(eq(performances.id, id));

    if (!performanceRow) {
      return null;
    }

    // Fetch related data in parallel
    const [priceTierRows, showtimeRows, castingRows, seatMapRows] = await Promise.all([
      this.db
        .select()
        .from(priceTiers)
        .where(eq(priceTiers.performanceId, id))
        .orderBy(priceTiers.sortOrder),
      this.db
        .select()
        .from(showtimes)
        .where(eq(showtimes.performanceId, id))
        .orderBy(showtimes.dateTime),
      this.db
        .select()
        .from(castings)
        .where(eq(castings.performanceId, id))
        .orderBy(castings.sortOrder),
      this.db
        .select()
        .from(seatMaps)
        .where(eq(seatMaps.performanceId, id)),
    ]);

    const perf = performanceRow.performances;
    const venue = performanceRow.venues;

    const result: PerformanceWithDetails = {
      id: perf.id,
      title: perf.title,
      genre: perf.genre,
      subcategory: perf.subcategory,
      venueId: perf.venueId,
      posterUrl: perf.posterUrl,
      description: perf.description,
      startDate: perf.startDate?.toISOString() ?? '',
      endDate: perf.endDate?.toISOString() ?? '',
      runtime: perf.runtime,
      ageRating: perf.ageRating,
      status: perf.status,
      salesInfo: perf.salesInfo,
      viewCount: perf.viewCount,
      createdAt: perf.createdAt?.toISOString() ?? '',
      updatedAt: perf.updatedAt?.toISOString() ?? '',
      venue: venue
        ? { id: venue.id, name: venue.name, address: venue.address }
        : null,
      priceTiers: priceTierRows.map((pt) => ({
        id: pt.id,
        performanceId: pt.performanceId,
        tierName: pt.tierName,
        price: pt.price,
        sortOrder: pt.sortOrder,
      })),
      showtimes: showtimeRows.map((st) => ({
        id: st.id,
        performanceId: st.performanceId,
        dateTime: st.dateTime?.toISOString() ?? '',
      })),
      castings: castingRows.map((c) => ({
        id: c.id,
        performanceId: c.performanceId,
        actorName: c.actorName,
        roleName: c.roleName,
        photoUrl: c.photoUrl,
        sortOrder: c.sortOrder,
      })),
      seatMap: seatMapRows[0]
        ? {
            id: seatMapRows[0].id,
            performanceId: seatMapRows[0].performanceId,
            svgUrl: seatMapRows[0].svgUrl,
            seatConfig: seatMapRows[0].seatConfig as PerformanceWithDetails['seatMap'] extends null ? never : NonNullable<PerformanceWithDetails['seatMap']>['seatConfig'],
            totalSeats: seatMapRows[0].totalSeats,
          }
        : null,
    };

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async getHomeBanners(): Promise<Banner[]> {
    const cacheKey = 'cache:home:banners';
    const cached = await this.cacheService.get<Banner[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db
      .select()
      .from(banners)
      .where(eq(banners.isActive, true))
      .orderBy(banners.sortOrder);

    const result: Banner[] = rows.map((b) => ({
      id: b.id,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    }));

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async getHotPerformances(): Promise<PerformanceCardData[]> {
    const cacheKey = 'cache:home:hot';
    const cached = await this.cacheService.get<PerformanceCardData[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db
      .select({
        id: performances.id,
        title: performances.title,
        genre: performances.genre,
        posterUrl: performances.posterUrl,
        status: performances.status,
        startDate: performances.startDate,
        endDate: performances.endDate,
        venueName: venues.name,
      })
      .from(performances)
      .leftJoin(venues, eq(performances.venueId, venues.id))
      .where(inArray(performances.status, ['selling', 'closing_soon']))
      .orderBy(desc(performances.viewCount))
      .limit(4);

    const result: PerformanceCardData[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      genre: row.genre,
      posterUrl: row.posterUrl,
      status: row.status,
      startDate: row.startDate?.toISOString() ?? '',
      endDate: row.endDate?.toISOString() ?? '',
      venueName: row.venueName ?? null,
    }));

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  async getNewPerformances(): Promise<PerformanceCardData[]> {
    const cacheKey = 'cache:home:new';
    const cached = await this.cacheService.get<PerformanceCardData[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.db
      .select({
        id: performances.id,
        title: performances.title,
        genre: performances.genre,
        posterUrl: performances.posterUrl,
        status: performances.status,
        startDate: performances.startDate,
        endDate: performances.endDate,
        venueName: venues.name,
      })
      .from(performances)
      .leftJoin(venues, eq(performances.venueId, venues.id))
      .where(inArray(performances.status, ['selling', 'upcoming', 'closing_soon']))
      .orderBy(desc(performances.createdAt))
      .limit(4);

    const result: PerformanceCardData[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      genre: row.genre,
      posterUrl: row.posterUrl,
      status: row.status,
      startDate: row.startDate?.toISOString() ?? '',
      endDate: row.endDate?.toISOString() ?? '',
      venueName: row.venueName ?? null,
    }));

    await this.cacheService.set(cacheKey, result);
    return result;
  }
}
