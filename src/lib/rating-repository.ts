// Database Repository Layer - Rating Repository

import type { RatingRecord, RatingType, RatingScale } from "@/lib/hotel-types";

interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
}

export function ratingRepository(db: SqliteDatabase) {
  function nowIso(): string {
    return new Date().toISOString();
  }

  function findById(id: number): RatingRecord | null {
    const row = db.prepare(`
      SELECT
        r.id,
        r.rating_type,
        r.reference_type,
        r.reference_id,
        r.quality_of_service,
        r.facilities,
        r.food_quality,
        r.cleanliness,
        r.source_awareness,
        r.general_rating,
        r.comment,
        r.submitted_at,
        r.submitter_phone,
        CASE
          WHEN r.reference_type = 'Transaction' THEN COALESCE(t.guest_name, 'Guest tidak ditemukan')
          ELSE COALESCE(v.vendor_name, 'Vendor tidak ditemukan')
        END AS reference_label
      FROM ratings r
      LEFT JOIN transactions t
        ON r.reference_type = 'Transaction' AND r.reference_id = t.id
      LEFT JOIN vendors v
        ON r.reference_type = 'Vendor' AND r.reference_id = v.id
      WHERE r.id = ?
    `).get(id) as RatingRecord | undefined;

    return row || null;
  }

  async function create(input: {
    ratingType: RatingType;
    referenceType: "Transaction" | "Vendor";
    referenceId: number;
    qualityOfService: RatingScale;
    facilities: RatingScale;
    foodQuality: RatingScale;
    cleanliness: RatingScale;
    sourceAwareness: string;
    generalRating: number;
    comment?: string;
    submitterPhone?: string;
  }): Promise<{ id: number }> {
    const result = db.prepare(`
      INSERT INTO ratings (
        rating_type,
        reference_type,
        reference_id,
        quality_of_service,
        facilities,
        food_quality,
        cleanliness,
        source_awareness,
        general_rating,
        comment,
        submitter_phone,
        submitted_at
      ) VALUES (
        @ratingType,
        @referenceType,
        @referenceId,
        @qualityOfService,
        @facilities,
        @foodQuality,
        @cleanliness,
        @sourceAwareness,
        @generalRating,
        @comment,
        @submitterPhone,
        @submittedAt
      )
    `).run({
      ratingType: input.ratingType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      qualityOfService: input.qualityOfService,
      facilities: input.facilities,
      foodQuality: input.foodQuality,
      cleanliness: input.cleanliness,
      sourceAwareness: input.sourceAwareness.trim() || "Other",
      generalRating: Math.max(1, Math.min(5, Math.floor(input.generalRating))),
      comment: input.comment?.trim() || null,
      submitterPhone: input.submitterPhone || null,
      submittedAt: nowIso(),
    });

    return { id: Number(result.lastInsertRowid) };
  }

  function list(filter: {
    ratingType?: RatingType;
    minRating?: number;
    maxRating?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  } = {}): { data: RatingRecord[]; total: number } {
    const { ratingType, minRating, maxRating, search = "", startDate, endDate } = filter;

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];

    if (ratingType) {
      whereClause += " AND r.rating_type = ?";
      params.push(ratingType);
    }

    if (minRating !== undefined) {
      whereClause += " AND r.general_rating >= ?";
      params.push(minRating);
    }

    if (maxRating !== undefined) {
      whereClause += " AND r.general_rating <= ?";
      params.push(maxRating);
    }

    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      whereClause += " AND (r.comment LIKE ? OR t.guest_name LIKE ? OR v.vendor_name LIKE ?)";
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (startDate) {
      whereClause += " AND date(r.submitted_at) >= date(?)";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND date(r.submitted_at) <= date(?)";
      params.push(endDate);
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM ratings r
      LEFT JOIN transactions t ON r.reference_type = 'Transaction' AND r.reference_id = t.id
      LEFT JOIN vendors v ON r.reference_type = 'Vendor' AND r.reference_id = v.id
      ${whereClause}
    `).get(...params) as { count: number };

    const data = db.prepare(`
      SELECT
        r.id,
        r.rating_type,
        r.reference_type,
        r.reference_id,
        r.quality_of_service,
        r.facilities,
        r.food_quality,
        r.cleanliness,
        r.source_awareness,
        r.general_rating,
        r.comment,
        r.submitted_at,
        r.submitter_phone,
        CASE
          WHEN r.reference_type = 'Transaction' THEN COALESCE(t.guest_name, 'Guest tidak ditemukan')
          ELSE COALESCE(v.vendor_name, 'Vendor tidak ditemukan')
        END AS reference_label
      FROM ratings r
      LEFT JOIN transactions t
        ON r.reference_type = 'Transaction' AND r.reference_id = t.id
      LEFT JOIN vendors v
        ON r.reference_type = 'Vendor' AND r.reference_id = v.id
      ${whereClause}
      ORDER BY r.submitted_at DESC, r.id DESC
    `).all(...params) as RatingRecord[];

    return { data, total: countRow.count };
  }

  function getSummaryByType(): Array<{
    rating_type: RatingType;
    total: number;
    avg_rating: number;
  }> {
    return db.prepare(`
      SELECT
        rating_type,
        COUNT(*) AS total,
        ROUND(AVG(general_rating), 2) AS avg_rating
      FROM ratings
      GROUP BY rating_type
      ORDER BY total DESC
    `).all() as Array<{ rating_type: RatingType; total: number; avg_rating: number }>;
  }

  function getSummaryByDate(startDate?: string, endDate?: string): Array<{
    date: string;
    total: number;
    avg_rating: number;
  }> {
    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];

    if (startDate) {
      whereClause += " AND date(submitted_at) >= date(?)";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND date(submitted_at) <= date(?)";
      params.push(endDate);
    }

    return db.prepare(`
      SELECT
        date(submitted_at) AS date,
        COUNT(*) AS total,
        ROUND(AVG(general_rating), 2) AS avg_rating
      FROM ratings
      ${whereClause}
      GROUP BY date(submitted_at)
      ORDER BY date DESC
    `).all(...params) as Array<{ date: string; total: number; avg_rating: number }>;
  }

  function getLowRatings(threshold = 3): RatingRecord[] {
    return db.prepare(`
      SELECT
        r.id,
        r.rating_type,
        r.reference_type,
        r.reference_id,
        r.quality_of_service,
        r.facilities,
        r.food_quality,
        r.cleanliness,
        r.source_awareness,
        r.general_rating,
        r.comment,
        r.submitted_at,
        r.submitter_phone,
        CASE
          WHEN r.reference_type = 'Transaction' THEN COALESCE(t.guest_name, 'Guest tidak ditemukan')
          ELSE COALESCE(v.vendor_name, 'Vendor tidak ditemukan')
        END AS reference_label
      FROM ratings r
      LEFT JOIN transactions t
        ON r.reference_type = 'Transaction' AND r.reference_id = t.id
      LEFT JOIN vendors v
        ON r.reference_type = 'Vendor' AND r.reference_id = v.id
      WHERE r.general_rating <= ?
      ORDER BY r.general_rating ASC, r.submitted_at DESC
    `).all(threshold) as RatingRecord[];
  }

  return {
    findById,
    create,
    list,
    getSummaryByType,
    getSummaryByDate,
    getLowRatings,
  };
}

export type RatingRepository = ReturnType<typeof ratingRepository>;