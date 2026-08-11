import { describe, expect, it, vi } from 'vitest';

import { buildWclFactSnapshot } from './wclFactSnapshot';
import { captureWclFactInputs } from './wclFactSource';

const report = {
  code: 'CAPTURE1',
  start: 100,
  end: 200,
  fights: [{ id: 1, start_time: 100, end_time: 200 }],
  enemies: [
    {
      id: 10,
      guid: 1001,
      type: 'NPC',
      fights: [{ id: 1 }],
    },
  ],
};

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('WCL fact API source capture', () => {
  it('normalizes the API base, aggregates event pages, and preserves the report code', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/report/fights/CAPTURE1')) return jsonResponse(report);
      if (url.includes('start=100')) {
        return jsonResponse({
          code: 'CAPTURE1',
          events: [{ type: 'cast', timestamp: 120 }],
          nextPageTimestamp: 150,
        });
      }
      return jsonResponse({
        reportCode: 'CAPTURE1',
        events: [{ type: 'cast', timestamp: 180 }],
      });
    });

    const result = await captureWclFactInputs({
      apiBase: 'http://localhost:9528',
      reportCode: 'CAPTURE1',
      fightId: 1,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.eventPages).toBe(2);
    expect(result.report?.code).toBe('CAPTURE1');
    expect(result.events).toEqual({
      code: 'CAPTURE1',
      events: [
        { type: 'cast', timestamp: 120 },
        { type: 'cast', timestamp: 180 },
      ],
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/v1/report/fights/CAPTURE1');
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('/v1/report/events/CAPTURE1');
  });

  it('retains the validated id for an implicit single-fight scope', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/report/fights/CAPTURE1')) return jsonResponse(report);
      return jsonResponse({ code: 'CAPTURE1', events: [] });
    });

    const result = await captureWclFactInputs({
      apiBase: 'http://localhost:9528',
      reportCode: 'CAPTURE1',
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.fightId).toBe(1);
  });

  it('feeds the captured scope into the existing adapter and keeps fightId in the digest payload', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/report/fights/CAPTURE1')) return jsonResponse(report);
      return jsonResponse({
        code: 'CAPTURE1',
        events: [
          {
            type: 'cast',
            timestamp: 120,
            sourceID: 10,
            ability: { guid: 2001 },
          },
        ],
      });
    });
    const captured = await captureWclFactInputs({
      apiBase: 'https://rpglogs.example.test/v1',
      reportCode: 'CAPTURE1',
      fightId: 1,
      fetchImpl,
    });
    const result = await buildWclFactSnapshot(captured.report, captured.events, {
      dungeonId: 'ruby-life-pools',
      season: 'midnight-s2',
      gameBuild: 'test-build',
      snapshotId: 'capture-snapshot',
      evidenceRef: 'wcl-report:CAPTURE1',
      capturedAt: '2026-08-11T00:00:00.000Z',
      fightId: captured.fightId,
      licenseStatus: 'reference-only',
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.fightId).toBe(1);
    expect(result.snapshot?.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('fails before events requests when a multi-fight report has no explicit scope', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        ...report,
        fights: [
          { id: 1, start_time: 100, end_time: 150 },
          { id: 2, start_time: 200, end_time: 250 },
        ],
      }),
    );
    const result = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((item) => item.code)).toContain('WCL_FACT_FIGHT_SCOPE_REQUIRED');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns an explicit warning for enemy-only capture', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(report));
    const result = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      includeEvents: false,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.events).toBeUndefined();
    expect(result.warnings.map((item) => item.code)).toContain('WCL_FACT_API_EVENTS_SKIPPED');
  });

  it('rejects non-increasing pagination and conflicting response aliases', async () => {
    const paginationFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/report/fights/')) return jsonResponse(report);
      return jsonResponse({ events: [], nextPageTimestamp: 100 });
    });
    const pagination = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl: paginationFetch,
    });
    expect(pagination.errors.map((item) => item.code)).toContain('WCL_FACT_API_PAGINATION_INVALID');

    const aliasFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/report/fights/')) return jsonResponse(report);
      return jsonResponse({ code: 'CAPTURE1', reportCode: 'OTHER', events: [] });
    });
    const aliases = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl: aliasFetch,
    });
    expect(aliases.errors.map((item) => item.code)).toContain(
      'WCL_FACT_SOURCE_CODE_ALIAS_MISMATCH',
    );

    const missingNextTimestamp = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/report/fights/')) return jsonResponse(report);
      return jsonResponse({ events: [], hasMore: true, nextPageTimestamp: null });
    });
    const missingNext = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl: missingNextTimestamp,
    });
    expect(missingNext.errors.map((item) => item.code)).toContain(
      'WCL_FACT_API_PAGINATION_INVALID',
    );

    const malformedHasMore = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/report/fights/')) return jsonResponse(report);
      return jsonResponse({ events: [], hasMore: 'true' });
    });
    const malformed = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl: malformedHasMore,
    });
    expect(malformed.errors.map((item) => item.code)).toContain('WCL_FACT_API_PAGINATION_INVALID');
  });

  it('rejects events from another report and casts outside the verified fight range', async () => {
    const mismatchedEvents = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/report/fights/')) return jsonResponse(report);
      return jsonResponse({ code: 'OTHER_REPORT', events: [] });
    });
    const mismatch = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl: mismatchedEvents,
    });
    expect(mismatch.errors.map((item) => item.code)).toContain('WCL_FACT_API_EVENTS_CODE_MISMATCH');

    const outOfRange = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/report/fights/')) return jsonResponse(report);
      return jsonResponse({ code: 'CAPTURE1', events: [{ type: 'cast', timestamp: 50 }] });
    });
    const rangeResult = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      fetchImpl: outOfRange,
    });
    expect(rangeResult.errors.map((item) => item.code)).toContain(
      'WCL_FACT_API_EVENT_OUT_OF_RANGE',
    );
  });

  it('bounds response size and total events, and supports caller cancellation', async () => {
    const largeResponse = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      maxResponseBytes: 10,
      fetchImpl: vi.fn(async () => jsonResponse(report)),
    });
    expect(largeResponse.errors.map((item) => item.code)).toContain(
      'WCL_FACT_API_RESPONSE_TOO_LARGE',
    );

    const eventLimit = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      maxEvents: 1,
      fetchImpl: vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/report/fights/')
          ? jsonResponse(report)
          : jsonResponse({ code: 'CAPTURE1', events: [{ type: 'cast' }, { type: 'cast' }] }),
      ),
    });
    expect(eventLimit.errors.map((item) => item.code)).toContain(
      'WCL_FACT_API_EVENT_LIMIT_REACHED',
    );

    const controller = new AbortController();
    controller.abort();
    const aborted = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      signal: controller.signal,
      fetchImpl: vi.fn(),
    });
    expect(aborted.errors.map((item) => item.code)).toContain('WCL_FACT_API_ABORTED');

    const timedOut = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      timeoutMs: 1,
      fetchImpl: vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) =>
          await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
              once: true,
            });
          }),
      ),
    });
    expect(timedOut.errors.map((item) => item.code)).toContain('WCL_FACT_API_TIMEOUT');
  });

  it('appends a large cast page without spread-argument or duplicate-scan failures', async () => {
    const largeEvents = Array.from({ length: 130000 }, (_, index) => ({
      type: 'cast',
      timestamp: 100 + (index % 101),
    }));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/report/fights/')
        ? jsonResponse(report)
        : jsonResponse({ code: 'CAPTURE1', events: largeEvents }),
    );
    const result = await captureWclFactInputs({
      apiBase: 'http://localhost:9528/v1',
      reportCode: 'CAPTURE1',
      maxEvents: 130000,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.events?.events).toHaveLength(130000);
  });

  it('normalizes invalid API responses into stable diagnostics', async () => {
    const result = await captureWclFactInputs({
      apiBase: 'ftp://localhost:9528',
      reportCode: 'CAPTURE1',
      fetchImpl: vi.fn(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('WCL_FACT_API_BASE_INVALID');
  });
});
