import { it, expect, describe } from 'vitest';

import type { EventLogItem, VisitorSummary, TimeseriesResponse } from '../../api/monitoring-api';

// ----------------------------------------------------------------------

/**
 * Convert timeseries data to ApexCharts series format
 */
const convertTimeseriesToSeries = (
  data: TimeseriesResponse | undefined,
  label: string
): { name: string; data: number[] } | null => {
  if (!data || !data.dataPoints || data.dataPoints.length === 0) {
    return null;
  }

  return {
    name: label,
    data: data.dataPoints.map((point) => point.value),
  };
};

/**
 * Get x-axis categories from timeseries data
 */
const getXAxisCategories = (data: TimeseriesResponse | undefined): string[] => {
  if (!data || !data.dataPoints || data.dataPoints.length === 0) {
    return [];
  }

  return data.dataPoints.map((point) => {
    const date = new Date(point.timestamp);
    // Simplified for testing - just return formatted date
    return date.toISOString();
  });
};

/**
 * Map visitor summary to table row data
 */
const mapVisitorToTableRow = (visitor: VisitorSummary) => ({
    visitorId: visitor.visitorId,
    userId: visitor.userId || '-',
    firstSeenAt: new Date(visitor.firstSeenAt).toLocaleString('ko-KR'),
    lastSeenAt: new Date(visitor.lastSeenAt).toLocaleString('ko-KR'),
    pageViewCount: visitor.pageViewCount,
    eventCount: visitor.eventCount,
    lastPath: visitor.lastPath || '-',
    lastDevice: visitor.lastDevice || '-',
  });

/**
 * Map event log item to table row data
 */
const mapEventToTableRow = (event: EventLogItem) => ({
    id: event.id,
    occurredAt: new Date(event.occurredAt).toLocaleString('ko-KR'),
    eventType: event.eventType,
    resourceKey: event.resourceKey,
    action: event.action,
    label: event.label || '-',
    visitorId: event.visitorId || '-',
    userId: event.userId || '-',
    path: event.path || '-',
    hasMetadata: Boolean(event.metadata),
  });

// ----------------------------------------------------------------------

describe('Monitoring Utils', () => {
  describe('convertTimeseriesToSeries', () => {
    it('should convert timeseries data to series format', () => {
      const data: TimeseriesResponse = {
        metric: 'PV',
        interval: 'DAY',
        dataPoints: [
          { timestamp: '2024-01-01T00:00:00Z', value: 100 },
          { timestamp: '2024-01-02T00:00:00Z', value: 150 },
          { timestamp: '2024-01-03T00:00:00Z', value: 200 },
        ],
      };

      const result = convertTimeseriesToSeries(data, 'PV');

      expect(result).toEqual({
        name: 'PV',
        data: [100, 150, 200],
      });
    });

    it('should return null for empty data', () => {
      const result = convertTimeseriesToSeries(undefined, 'PV');
      expect(result).toBeNull();
    });

    it('should return null for empty dataPoints', () => {
      const data: TimeseriesResponse = {
        metric: 'PV',
        interval: 'DAY',
        dataPoints: [],
      };

      const result = convertTimeseriesToSeries(data, 'PV');
      expect(result).toBeNull();
    });
  });

  describe('getXAxisCategories', () => {
    it('should extract categories from timeseries data', () => {
      const data: TimeseriesResponse = {
        metric: 'PV',
        interval: 'DAY',
        dataPoints: [
          { timestamp: '2024-01-01T00:00:00Z', value: 100 },
          { timestamp: '2024-01-02T00:00:00Z', value: 150 },
        ],
      };

      const result = getXAxisCategories(data);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('2024-01-01T00:00:00.000Z');
      expect(result[1]).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should return empty array for empty data', () => {
      const result = getXAxisCategories(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('mapVisitorToTableRow', () => {
    it('should map visitor summary to table row', () => {
      const visitor: VisitorSummary = {
        visitorId: 'visitor-123',
        firstSeenAt: '2024-01-01T00:00:00Z',
        lastSeenAt: '2024-01-15T10:00:00Z',
        pageViewCount: 50,
        eventCount: 25,
        lastPath: '/dashboard',
        lastDevice: 'desktop',
        userId: 'user-456',
      };

      const result = mapVisitorToTableRow(visitor);

      expect(result.visitorId).toBe('visitor-123');
      expect(result.userId).toBe('user-456');
      expect(result.pageViewCount).toBe(50);
      expect(result.eventCount).toBe(25);
      expect(result.lastPath).toBe('/dashboard');
      expect(result.lastDevice).toBe('desktop');
    });

    it('should handle null values with fallback', () => {
      const visitor: VisitorSummary = {
        visitorId: 'visitor-123',
        firstSeenAt: '2024-01-01T00:00:00Z',
        lastSeenAt: '2024-01-15T10:00:00Z',
        pageViewCount: 10,
        eventCount: 5,
        lastPath: null,
        lastDevice: null,
        userId: null,
      };

      const result = mapVisitorToTableRow(visitor);

      expect(result.userId).toBe('-');
      expect(result.lastPath).toBe('-');
      expect(result.lastDevice).toBe('-');
    });
  });

  describe('mapEventToTableRow', () => {
    it('should map event log item to table row', () => {
      const event: EventLogItem = {
        id: 'event-123',
        occurredAt: '2024-01-15T10:00:00Z',
        eventType: 'click',
        resourceKey: 'menu.admin.users',
        action: 'view_users',
        label: 'Admin Users 조회',
        visitorId: 'visitor-123',
        userId: 456, // Backend uses number
        path: '/admin/users',
        metadata: { button: 'submit' },
      };

      const result = mapEventToTableRow(event);

      expect(result.id).toBe('event-123');
      expect(result.eventType).toBe('click');
      expect(result.resourceKey).toBe('menu.admin.users');
      expect(result.action).toBe('view_users');
      expect(result.label).toBe('Admin Users 조회');
      expect(result.visitorId).toBe('visitor-123');
      expect(result.userId).toBe('user-456');
      expect(result.path).toBe('/admin/users');
      expect(result.hasMetadata).toBe(true);
    });

    it('should handle null values with fallback', () => {
      const event: EventLogItem = {
        id: 'event-123',
        occurredAt: '2024-01-15T10:00:00Z',
        eventType: 'view',
        resourceKey: 'menu.dashboard',
        action: 'view_dashboard',
        label: null,
        visitorId: null,
        userId: null,
        path: null,
        metadata: null,
      };

      const result = mapEventToTableRow(event);

      expect(result.label).toBe('-');
      expect(result.visitorId).toBe('-');
      expect(result.userId).toBe('-');
      expect(result.path).toBe('-');
      expect(result.hasMetadata).toBe(false);
    });
  });
});
