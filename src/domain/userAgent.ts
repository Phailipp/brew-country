/**
 * Browser and OS family with major versions only ("Safari 17 / iOS 17"), so a
 * crash report never carries the full, fingerprintable user-agent string.
 */
export function coarseUserAgent(ua: string): string {
  const os =
    /iPhone|iPad|iPod/.test(ua) ? `iOS ${ua.match(/OS (\d+)_/)?.[1] ?? '?'}`
    : /Android/.test(ua) ? `Android ${ua.match(/Android (\d+)/)?.[1] ?? '?'}`
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'other';
  // Order matters: Edge, Opera and Samsung also claim to be Chrome, Chrome to be Safari
  let browser: RegExpMatchArray | null = null;
  for (const token of ['Edg', 'OPR', 'SamsungBrowser', 'FxiOS', 'CriOS', 'Firefox', 'Chrome']) {
    browser = ua.match(new RegExp(`(${token})/(\\d+)`));
    if (browser) break;
  }
  if (!browser && /Safari\//.test(ua)) browser = ua.match(/(Version)\/(\d+)/);
  const name = browser ? ({ Edg: 'Edge', OPR: 'Opera', FxiOS: 'Firefox', CriOS: 'Chrome', Version: 'Safari' } as Record<string, string>)[browser[1]] ?? browser[1] : 'other';
  return `${name}${browser ? ` ${browser[2]}` : ''} / ${os}`;
}
