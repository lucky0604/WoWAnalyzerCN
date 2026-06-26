// Shared WCL URL/code parsing — used by both analyze_report and analyze_fight tools.

const WCL_REPORT_URL_RE =
  /(?:https?:\/\/)?(?:www\.|(?:[a-z]+\.)?(?:classic\.)?warcraftlogs\.com)\/reports\/([a-zA-Z0-9]{8,32})/;
const REPORT_CODE_RE = /^[a-zA-Z0-9]{16}$/;

export function extractReportCode(input: string): string {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(WCL_REPORT_URL_RE);
  if (urlMatch) {
    return urlMatch[1];
  }

  const codeMatch = trimmed.match(REPORT_CODE_RE);
  if (codeMatch) {
    return codeMatch[0];
  }

  const fallback = trimmed.match(/[a-zA-Z0-9]{16}/);
  if (fallback) {
    return fallback[0];
  }

  throw new Error(
    `无效的 WCL 战报标识: "${input}"。请提供完整的 WCL 战报 URL (如 https://cn.warcraftlogs.com/reports/ABC123...) 或 16 位战报代码。`,
  );
}
