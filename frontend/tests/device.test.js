import { describe, it, expect } from 'vitest';
import { deviceLabel } from '../src/lib/device.js';

// A session is listed under this name in Account › Devices (18 Oct 2026): "Android" × 3 and "Browser" told the
// head nothing about which was their phone and which their Mac.
const nav = (userAgent, extra = {}) => ({ userAgent, ...extra });
const win = (standalone = false, referrer = '') => ({ matchMedia: () => ({ matches: standalone }), document: { referrer } });
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0';

describe('device names a person recognises', () => {
  it('a Mac in Chrome', () => expect(deviceLabel(nav(MAC_CHROME), win())).toBe('Mac · Chrome'));
  it('an Android phone in Chrome', () => expect(deviceLabel(nav(ANDROID_CHROME), win())).toBe('Android · Chrome'));
  it('the installed app on Android (home screen)', () => expect(deviceLabel(nav(ANDROID_CHROME), win(true))).toBe('Android · installed app'));
  it('the Play Store app (a trusted web activity)', () => expect(deviceLabel(nav(ANDROID_CHROME), win(false, 'android-app://org.iyfdelhi.sadhana'))).toBe('Android · installed app'));
  it('an iPhone in Safari', () => expect(deviceLabel(nav(IPHONE_SAFARI), win())).toBe('iPhone · Safari'));
  it('Windows in Edge, not Chrome', () => expect(deviceLabel(nav(WIN_EDGE), win())).toBe('Windows · Edge'));
  it('fits the 60 characters the server keeps', () => expect(deviceLabel(nav(ANDROID_CHROME), win()).length).toBeLessThanOrEqual(60));
});
