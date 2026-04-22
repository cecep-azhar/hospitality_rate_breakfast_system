// Database Repository Layer - Notification Repository

import type { NotificationLogRecord, NotificationMessageType, NotificationStatus } from "@/lib/hotel-types";

interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
}

export function notificationRepository(db: SqliteDatabase) {
  function nowIso(): string {
    return new Date().toISOString();
  }

  function create(input: {
    recipientPhone: string;
    messageType: NotificationMessageType;
    payload: unknown;
    status: NotificationStatus;
  }): number {
    const result = db.prepare(`
      INSERT INTO notification_logs (
        recipient_phone,
        message_type,
        payload,
        status,
        sent_at
      ) VALUES (@recipientPhone, @messageType, @payload, @status, @sentAt)
    `).run({
      recipientPhone: input.recipientPhone,
      messageType: input.messageType,
      payload: JSON.stringify(input.payload ?? {}),
      status: input.status,
      sentAt: nowIso(),
    });

    return Number(result.lastInsertRowid);
  }

  function findById(id: number): NotificationLogRecord | null {
    const row = db.prepare(`
      SELECT
        id,
        recipient_phone,
        message_type,
        payload,
        status,
        sent_at
      FROM notification_logs
      WHERE id = ?
    `).get(id) as NotificationLogRecord | undefined;

    return row || null;
  }

  function updateStatus(id: number, status: NotificationStatus): void {
    db.prepare(`
      UPDATE notification_logs
      SET status = ?
      WHERE id = ?
    `).run(status, id);
  }

  function list(filter: {
    status?: NotificationStatus;
    messageType?: NotificationMessageType;
    startDate?: string;
    endDate?: string;
    recipientPhone?: string;
    limit?: number;
    offset?: number;
  } = {}): { data: NotificationLogRecord[]; total: number } {
    const { status, messageType, startDate, endDate, recipientPhone, limit = 100, offset = 0 } = filter;

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    if (messageType) {
      whereClause += " AND message_type = ?";
      params.push(messageType);
    }

    if (startDate) {
      whereClause += " AND date(sent_at) >= date(?)";
      params.push(startDate);
    }

    if (endDate) {
      whereClause += " AND date(sent_at) <= date(?)";
      params.push(endDate);
    }

    if (recipientPhone) {
      whereClause += " AND recipient_phone LIKE ?";
      params.push(`%${recipientPhone}%`);
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM notification_logs ${whereClause}
    `).get(...params) as { count: number };

    const data = db.prepare(`
      SELECT
        id,
        recipient_phone,
        message_type,
        payload,
        status,
        sent_at
      FROM notification_logs
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as NotificationLogRecord[];

    return { data, total: countRow.count };
  }

  function getFailedNotifications(limit = 50): NotificationLogRecord[] {
    return db.prepare(`
      SELECT
        id,
        recipient_phone,
        message_type,
        payload,
        status,
        sent_at
      FROM notification_logs
      WHERE status = 'Failed'
      ORDER BY sent_at DESC
      LIMIT ?
    `).all(limit) as NotificationLogRecord[];
  }

  function getPendingNotifications(limit = 20): NotificationLogRecord[] {
    return db.prepare(`
      SELECT
        id,
        recipient_phone,
        message_type,
        payload,
        status,
        sent_at
      FROM notification_logs
      WHERE status = 'Pending'
      ORDER BY sent_at ASC
      LIMIT ?
    `).all(limit) as NotificationLogRecord[];
  }

  function retry(id: number, newStatus: NotificationStatus): void {
    db.prepare(`
      UPDATE notification_logs
      SET status = ?, sent_at = ?
      WHERE id = ?
    `).run(newStatus, nowIso(), id);
  }

  function getStats(startDate?: string, endDate?: string): {
    total: number;
    success: number;
    failed: number;
    pending: number;
    byType: Array<{ message_type: NotificationMessageType; total: number }>;
  } {
    let whereClause = "";
    const params: unknown[] = [];

    if (startDate || endDate) {
      whereClause = "WHERE 1=1";
      if (startDate) {
        whereClause += " AND date(sent_at) >= date(?)";
        params.push(startDate);
      }
      if (endDate) {
        whereClause += " AND date(sent_at) <= date(?)";
        params.push(endDate);
      }
    }

    const totals = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending
      FROM notification_logs
      ${whereClause}
    `).get(...params) as { total: number; success: number; failed: number; pending: number };

    const byType = db.prepare(`
      SELECT
        message_type,
        COUNT(*) as total
      FROM notification_logs
      ${whereClause}
      GROUP BY message_type
      ORDER BY total DESC
    `).all(...params) as Array<{ message_type: NotificationMessageType; total: number }>;

    return {
      total: totals.total,
      success: totals.success,
      failed: totals.failed,
      pending: totals.pending,
      byType,
    };
  }

  return {
    create,
    findById,
    updateStatus,
    list,
    getFailedNotifications,
    getPendingNotifications,
    retry,
    getStats,
  };
}

export type NotificationRepository = ReturnType<typeof notificationRepository>;