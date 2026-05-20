/**
 * Provider abstraction for Wow DB URL generation.
 * Centralizes URL building so the underlying provider can be swapped
 * without changing consumers.
 */

const DEFAULT_BASE_URL = 'https://db.damijing.com';

let _baseUrl: string = DEFAULT_BASE_URL;

/** Update the base URL used by all URL functions. */
export function setWowDbBaseUrl(url: string): void {
  // Normalize: strip trailing slash so URL functions can prepend "/" cleanly
  _baseUrl = url.replace(/\/+$/, '');
}

/** Get the current base URL. */
export function getWowDbBaseUrl(): string {
  return _baseUrl;
}

export function spellUrl(id: number): string {
  return `${_baseUrl}/spell/${id}`;
}

export function itemUrl(id: number): string {
  return `${_baseUrl}/item/${id}`;
}

export function npcUrl(id: number): string {
  return `${_baseUrl}/npc/${id}`;
}

export function itemSetUrl(id: number): string {
  return `${_baseUrl}/itemset/${id}`;
}

/** Returns null when the provider does not support resource linking. */
export function resourceUrl(_id: number): string | null {
  return null;
}
