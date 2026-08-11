/**
 * Read-only WCL API input capture for the dungeon fact pipeline.
 *
 * This module deliberately returns raw report/events payloads to the existing
 * WCL fact adapter. It does not know DungeonDocument entities and never writes
 * to the runtime registry or browser storage.
 */

export interface WclFactSourceDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface WclFactSourceOptions {
  apiBase: string;
  reportCode: string;
  fightId?: number;
  includeEvents?: boolean;
  maxEventPages?: number;
  maxEvents?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface WclFactSourceResult {
  ok: boolean;
  report?: Record<string, unknown>;
  events?: Record<string, unknown>;
  fightId?: number;
  eventPages: number;
  errors: WclFactSourceDiagnostic[];
  warnings: WclFactSourceDiagnostic[];
}

type RecordValue = Record<string, unknown>;

const diagnostic = (
  severity: WclFactSourceDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): WclFactSourceDiagnostic => ({ severity, code, path, message });

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDiagnostic = (value: unknown): value is WclFactSourceDiagnostic =>
  isRecord(value) &&
  (value.severity === 'error' || value.severity === 'warning') &&
  typeof value.code === 'string' &&
  typeof value.path === 'string' &&
  typeof value.message === 'string';

const positiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const castEventTypes = new Set(['cast', 'begincast', 'channel', 'beginchannel', 'empowerstart']);

interface NormalizedApiBase {
  origin: string;
  pathname: string;
}

class ResponseTooLargeError extends Error {}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new ResponseTooLargeError();
    }
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('WCL_FACT_API_BODY_UNSUPPORTED');
  }
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ResponseTooLargeError();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function normalizeApiBase(value: string): NormalizedApiBase | WclFactSourceDiagnostic {
  if (!nonEmptyString(value)) {
    return diagnostic(
      'error',
      'WCL_FACT_API_BASE_REQUIRED',
      'options.apiBase',
      '必须通过 --api-base 或 DUNGEON_WCL_API_BASE 提供 WCL API 根地址。',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return diagnostic(
      'error',
      'WCL_FACT_API_BASE_INVALID',
      'options.apiBase',
      'WCL API 根地址必须是绝对 http/https URL。',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return diagnostic(
      'error',
      'WCL_FACT_API_BASE_INVALID',
      'options.apiBase',
      'WCL API 根地址只允许 http 或 https。',
    );
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return diagnostic(
      'error',
      'WCL_FACT_API_BASE_INVALID',
      'options.apiBase',
      'WCL API 根地址不能包含账号、密码、query 或 hash。',
    );
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  return {
    origin: parsed.origin,
    pathname: /\/v\d+$/.test(pathname) ? pathname : `${pathname}/v1`,
  };
}

function makeEndpoint(
  base: NormalizedApiBase,
  path: string,
  query: Record<string, string>,
): string {
  const url = new URL(`${base.origin}${base.pathname}/${path.replace(/^\/+/, '')}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function readSourceCodeAliases(value: RecordValue, path: string): WclFactSourceDiagnostic[] {
  const aliases = [value.code, value.reportCode].filter(nonEmptyString);
  const uniqueAliases = [...new Set(aliases)];
  return uniqueAliases.length > 1
    ? [
        diagnostic(
          'error',
          'WCL_FACT_SOURCE_CODE_ALIAS_MISMATCH',
          path,
          '同一 API 响应中的 code 与 reportCode 不一致，拒绝选择其中一个继续处理。',
        ),
      ]
    : [];
}

function readResponseCode(value: RecordValue): string | undefined {
  const candidates = [value.code, value.reportCode].filter(nonEmptyString);
  return candidates[0];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

interface FightRange {
  id?: number;
  start: number;
  end: number;
}

function resolveFightRange(
  report: RecordValue,
  requestedFightId: number | undefined,
): FightRange | WclFactSourceDiagnostic[] {
  const rawFights = report.fights;
  if (rawFights !== undefined && !Array.isArray(rawFights)) {
    return [
      diagnostic(
        'error',
        'WCL_FACT_FIGHTS_INVALID',
        'report.fights',
        'report.fights 必须是数组；不能用其它形状表示 fight scope。',
      ),
    ];
  }
  if (!Array.isArray(rawFights) || rawFights.length === 0) {
    if (requestedFightId !== undefined) {
      return [
        diagnostic(
          'error',
          'WCL_FACT_FIGHT_SCOPE_UNAVAILABLE',
          'report.fights',
          '--fight-id 只能用于包含可验证 fights 数组的 report。',
        ),
      ];
    }
    if (!isFiniteNumber(report.start) || !isFiniteNumber(report.end) || report.end < report.start) {
      return [
        diagnostic(
          'error',
          'WCL_FACT_REPORT_RANGE_INVALID',
          'report',
          'report 缺少可用于 events 请求的有限且非倒置 start/end。',
        ),
      ];
    }
    return { start: report.start, end: report.end };
  }

  const fights = rawFights.filter(isRecord);
  if (fights.length !== rawFights.length) {
    return [
      diagnostic(
        'error',
        'WCL_FACT_FIGHT_RECORD_INVALID',
        'report.fights',
        'report.fights 中每个元素都必须是对象。',
      ),
    ];
  }
  const invalid = fights.find(
    (fight) =>
      !positiveInteger(fight.id) ||
      !isFiniteNumber(fight.start_time) ||
      !isFiniteNumber(fight.end_time) ||
      (fight.end_time as number) < (fight.start_time as number),
  );
  if (invalid) {
    return [
      diagnostic(
        'error',
        'WCL_FACT_FIGHT_RANGE_INVALID',
        'report.fights',
        'report.fights 中每个 fight 都必须有正整数 id，以及有限且非倒置的 start_time/end_time。',
      ),
    ];
  }
  const ids = fights.map((fight) => fight.id as number);
  if (new Set(ids).size !== ids.length) {
    return [
      diagnostic(
        'error',
        'WCL_FACT_DUPLICATE_FIGHT_ID',
        'report.fights',
        'report.fights 中存在重复 id，不能无歧义地选择目标战斗。',
      ),
    ];
  }
  for (let leftIndex = 0; leftIndex < fights.length; leftIndex += 1) {
    const left = fights[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < fights.length; rightIndex += 1) {
      const right = fights[rightIndex]!;
      if (
        (left.start_time as number) <= (right.end_time as number) &&
        (right.start_time as number) <= (left.end_time as number)
      ) {
        return [
          diagnostic(
            'error',
            'WCL_FACT_FIGHT_RANGE_OVERLAP',
            'report.fights',
            'report.fights 的时间范围重叠或边界相等，无法仅凭 timestamp 安全归属事件。',
          ),
        ];
      }
    }
  }
  if (requestedFightId === undefined) {
    if (fights.length > 1) {
      return [
        diagnostic(
          'error',
          'WCL_FACT_FIGHT_SCOPE_REQUIRED',
          'report.fights',
          'report 包含多场 fight；请提供 --fight-id，不能把全报告 roster 与单场 events 直接拼接。',
        ),
      ];
    }
    const fight = fights[0]!;
    return {
      id: fight.id as number,
      start: fight.start_time as number,
      end: fight.end_time as number,
    };
  }
  const selectedFight = fights.find((fight) => fight.id === requestedFightId);
  if (!selectedFight) {
    return [
      diagnostic(
        'error',
        'WCL_FACT_FIGHT_ID_NOT_FOUND',
        'options.fightId',
        `report.fights 中不存在 fight id：${requestedFightId}。`,
      ),
    ];
  }
  return {
    id: requestedFightId,
    start: selectedFight.start_time as number,
    end: selectedFight.end_time as number,
  };
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  deadline: number,
  maxResponseBytes: number,
  signal: AbortSignal | undefined,
): Promise<RecordValue | WclFactSourceDiagnostic> {
  if (signal?.aborted) {
    return diagnostic('error', 'WCL_FACT_API_ABORTED', url, 'WCL API 抓取已被调用方取消。');
  }
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    return diagnostic('error', 'WCL_FACT_API_TIMEOUT', url, 'WCL API 抓取超过整体超时预算。');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remainingMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const response = await fetchImpl(url, {
      credentials: 'omit',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return diagnostic(
        'error',
        'WCL_FACT_API_HTTP_ERROR',
        url,
        `WCL API 请求失败：HTTP ${response.status} ${response.statusText || ''}`.trim(),
      );
    }
    let rawText: string;
    try {
      rawText = await readResponseText(response, maxResponseBytes);
    } catch (error) {
      if (error instanceof ResponseTooLargeError) {
        return diagnostic(
          'error',
          'WCL_FACT_API_RESPONSE_TOO_LARGE',
          url,
          `WCL API 响应超过 ${maxResponseBytes} bytes 上限，拒绝继续解析。`,
        );
      }
      throw error;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      return diagnostic('error', 'WCL_FACT_API_JSON_INVALID', url, 'WCL API 响应不是合法 JSON。');
    }
    if (!isRecord(payload)) {
      return diagnostic(
        'error',
        'WCL_FACT_API_RESPONSE_INVALID',
        url,
        'WCL API 响应必须是 JSON 对象。',
      );
    }
    return payload;
  } catch (error) {
    if (signal?.aborted) {
      return diagnostic('error', 'WCL_FACT_API_ABORTED', url, 'WCL API 抓取已被调用方取消。');
    }
    if (controller.signal.aborted) {
      return diagnostic('error', 'WCL_FACT_API_TIMEOUT', url, 'WCL API 请求超过整体超时预算。');
    }
    if (error instanceof Error && error.message === 'WCL_FACT_API_BODY_UNSUPPORTED') {
      return diagnostic(
        'error',
        'WCL_FACT_API_BODY_UNSUPPORTED',
        url,
        'WCL API 响应不支持安全的流式 body 读取，拒绝继续解析。',
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return diagnostic('error', 'WCL_FACT_API_REQUEST_FAILED', url, `WCL API 请求异常：${message}`);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

function invalidOptions(options: WclFactSourceOptions): WclFactSourceDiagnostic[] {
  const errors: WclFactSourceDiagnostic[] = [];
  if (!nonEmptyString(options.reportCode)) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_REPORT_CODE_REQUIRED',
        'options.reportCode',
        'report code 不能为空。',
      ),
    );
  }
  if (options.fightId !== undefined && !positiveInteger(options.fightId)) {
    errors.push(
      diagnostic('error', 'WCL_FACT_FIGHT_ID_INVALID', 'options.fightId', 'fightId 必须是正整数。'),
    );
  }
  if (
    options.maxEventPages !== undefined &&
    (!positiveInteger(options.maxEventPages) || options.maxEventPages > 1000)
  ) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_API_PAGE_LIMIT_INVALID',
        'options.maxEventPages',
        'maxEventPages 必须是 1 到 1000 的正整数。',
      ),
    );
  }
  if (
    options.maxEvents !== undefined &&
    (!positiveInteger(options.maxEvents) || options.maxEvents > 1000000)
  ) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_API_EVENT_LIMIT_INVALID',
        'options.maxEvents',
        'maxEvents 必须是 1 到 1000000 的正整数。',
      ),
    );
  }
  if (
    options.maxResponseBytes !== undefined &&
    (!positiveInteger(options.maxResponseBytes) || options.maxResponseBytes > 256 * 1024 * 1024)
  ) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_API_RESPONSE_LIMIT_INVALID',
        'options.maxResponseBytes',
        'maxResponseBytes 必须是 1 到 256 MiB 的正整数。',
      ),
    );
  }
  if (
    options.timeoutMs !== undefined &&
    (!positiveInteger(options.timeoutMs) || options.timeoutMs > 300000)
  ) {
    errors.push(
      diagnostic(
        'error',
        'WCL_FACT_API_TIMEOUT_INVALID',
        'options.timeoutMs',
        'timeoutMs 必须是 1 到 300000 的正整数。',
      ),
    );
  }
  return errors;
}

/**
 * Fetch a report and, unless disabled, all event pages for the selected scope.
 * The returned events envelope has no pagination marker, so it can be passed
 * directly to buildWclFactSnapshot without weakening its completeness gate.
 */
export async function captureWclFactInputs(
  options: WclFactSourceOptions,
): Promise<WclFactSourceResult> {
  const errors = invalidOptions(options);
  const base = normalizeApiBase(options.apiBase);
  if (isDiagnostic(base)) errors.push(base);
  if (errors.length > 0) {
    return { ok: false, eventPages: 0, errors, warnings: [] };
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      eventPages: 0,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_API_FETCH_UNAVAILABLE',
          'options.fetchImpl',
          '当前运行环境没有 fetch 实现。',
        ),
      ],
      warnings: [],
    };
  }
  const timeoutMs = options.timeoutMs ?? 60000;
  const deadline = Date.now() + timeoutMs;
  const maxEvents = options.maxEvents ?? 250000;
  const maxResponseBytes = options.maxResponseBytes ?? 16 * 1024 * 1024;
  const normalizedBase = base as NormalizedApiBase;
  const reportUrl = makeEndpoint(
    normalizedBase,
    `report/fights/${encodeURIComponent(options.reportCode)}`,
    {
      translate: 'true',
    },
  );
  const rawReport = await fetchJson(
    fetchImpl,
    reportUrl,
    deadline,
    maxResponseBytes,
    options.signal,
  );
  if (isDiagnostic(rawReport)) {
    return { ok: false, eventPages: 0, errors: [rawReport], warnings: [] };
  }
  const reportCodeErrors = readSourceCodeAliases(rawReport, 'report');
  if (reportCodeErrors.length > 0) {
    return { ok: false, eventPages: 0, errors: reportCodeErrors, warnings: [] };
  }
  const responseCode = readResponseCode(rawReport);
  if (responseCode !== undefined && responseCode !== options.reportCode) {
    return {
      ok: false,
      eventPages: 0,
      errors: [
        diagnostic(
          'error',
          'WCL_FACT_API_REPORT_CODE_MISMATCH',
          'report.code',
          `API 返回的 report code ${responseCode} 与请求的 ${options.reportCode} 不一致。`,
        ),
      ],
      warnings: [],
    };
  }
  const report: RecordValue = { ...rawReport };
  const range = resolveFightRange(report, options.fightId);
  if (Array.isArray(range)) {
    return { ok: false, report, eventPages: 0, errors: range, warnings: [] };
  }
  if (options.includeEvents === false) {
    return {
      ok: true,
      report,
      fightId: options.fightId,
      eventPages: 0,
      errors: [],
      warnings: [
        diagnostic(
          'warning',
          'WCL_FACT_API_EVENTS_SKIPPED',
          'options.includeEvents',
          '已跳过 events 抓取；下游只会生成敌人目录 draft，不能作为完整事实快照。',
        ),
      ],
    };
  }

  const maxEventPages = options.maxEventPages ?? 100;
  const events: unknown[] = [];
  let receivedEvents = 0;
  let eventSourceCode: string | undefined;
  let everyEventPageHasCode = true;
  let pageStart = range.start;
  let eventPages = 0;
  while (true) {
    if (eventPages >= maxEventPages) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_PAGE_LIMIT_REACHED',
            'events',
            `events 分页超过上限 ${maxEventPages}，拒绝生成可能不完整的事实快照。`,
          ),
        ],
        warnings: [],
      };
    }
    const eventsUrl = makeEndpoint(
      normalizedBase,
      `report/events/${encodeURIComponent(options.reportCode)}`,
      { start: String(pageStart), end: String(range.end), translate: 'true' },
    );
    const page = await fetchJson(fetchImpl, eventsUrl, deadline, maxResponseBytes, options.signal);
    eventPages += 1;
    if (isDiagnostic(page)) {
      return { ok: false, report, eventPages, errors: [page], warnings: [] };
    }
    const pageErrors = readSourceCodeAliases(page, 'events');
    if (pageErrors.length > 0) {
      return { ok: false, report, eventPages, errors: pageErrors, warnings: [] };
    }
    if (!Array.isArray(page.events)) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_EVENTS_INVALID',
            'events',
            'WCL API events 响应必须包含 events 数组。',
          ),
        ],
        warnings: [],
      };
    }
    const pageCode = readResponseCode(page);
    if (pageCode === undefined) {
      everyEventPageHasCode = false;
    } else if (eventSourceCode === undefined) {
      eventSourceCode = pageCode;
    } else if (eventSourceCode !== pageCode) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_EVENTS_CODE_MISMATCH',
            'events.code',
            `不同 events 分页返回了不一致的 report code：${eventSourceCode} 与 ${pageCode}。`,
          ),
        ],
        warnings: [],
      };
    }
    if (pageCode !== undefined && pageCode !== options.reportCode) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_EVENTS_CODE_MISMATCH',
            'events.code',
            `API 返回的 events report code ${pageCode} 与请求的 ${options.reportCode} 不一致。`,
          ),
        ],
        warnings: [],
      };
    }
    if (receivedEvents + page.events.length > maxEvents) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_EVENT_LIMIT_REACHED',
            'events',
            `events 总数量超过 ${maxEvents} 上限，拒绝生成可能导致内存压力的快照。`,
          ),
        ],
        warnings: [],
      };
    }
    receivedEvents += page.events.length;
    for (const event of page.events) {
      if (!isRecord(event) || !castEventTypes.has(String(event.type))) continue;
      if (
        !isFiniteNumber(event.timestamp) ||
        event.timestamp < range.start ||
        event.timestamp > range.end
      ) {
        return {
          ok: false,
          report,
          eventPages,
          errors: [
            diagnostic(
              'error',
              'WCL_FACT_API_EVENT_OUT_OF_RANGE',
              'events',
              `events 中存在不在当前 fight [${range.start}, ${range.end}] 范围内的施法事件，拒绝跨 fight 污染。`,
            ),
          ],
          warnings: [],
        };
      }
      events.push(event);
    }
    const hasMoreMarker = page.hasMore === true || page.nextPage !== undefined;
    if (page.hasMore !== undefined && typeof page.hasMore !== 'boolean') {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_PAGINATION_INVALID',
            'events.hasMore',
            'events.hasMore 存在时必须是 boolean，拒绝把异常分页响应当作完整结果。',
          ),
        ],
        warnings: [],
      };
    }
    const nextPageTimestamp = page.nextPageTimestamp;
    if (hasMoreMarker && (nextPageTimestamp === undefined || nextPageTimestamp === null)) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_PAGINATION_INVALID',
            'events',
            'WCL API 提供了分页标记但缺少 nextPageTimestamp，无法证明 events 已完整。',
          ),
        ],
        warnings: [],
      };
    }
    if (nextPageTimestamp === undefined || nextPageTimestamp === null) break;
    if (
      !isFiniteNumber(nextPageTimestamp) ||
      nextPageTimestamp <= pageStart ||
      nextPageTimestamp > range.end
    ) {
      return {
        ok: false,
        report,
        eventPages,
        errors: [
          diagnostic(
            'error',
            'WCL_FACT_API_PAGINATION_INVALID',
            'events.nextPageTimestamp',
            'nextPageTimestamp 必须是严格递增且位于当前 fight 范围内的有限时间戳。',
          ),
        ],
        warnings: [],
      };
    }
    pageStart = nextPageTimestamp;
  }
  return {
    ok: true,
    report,
    events: {
      ...(everyEventPageHasCode && eventSourceCode ? { code: eventSourceCode } : {}),
      events,
    },
    fightId: options.fightId,
    eventPages,
    errors: [],
    warnings: [],
  };
}
