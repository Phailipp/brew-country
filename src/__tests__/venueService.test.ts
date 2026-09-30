import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OK = { elements: [{ type: 'node', id: 1, lat: 48.1372, lon: 11.5756, tags: { amenity: 'pub', name: 'Zum Test', brewery: 'Augustiner' } }] };
const TILE = '962_231'; // contains 48.1372/11.5756

type Svc = typeof import('../services/venueService');
let svc: Svc;
let fetchMock: ReturnType<typeof vi.fn>;

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(async () => {
  vi.resetModules(); // fresh in-memory cache + mirror state per test
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  svc = await import('../services/venueService');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('venueService', () => {
  it('parses venues of the requested tile', async () => {
    fetchMock.mockImplementation(() => json(OK));
    const venues = await svc.loadVenues([TILE]);
    expect(venues.map((v) => v.name)).toEqual(['Zum Test']);
    expect(venues[0].beerIds).toEqual(['augustiner']);
  });

  it('falls back to the next mirror when one fails', async () => {
    fetchMock.mockImplementationOnce(() => json({}, 504)).mockImplementation(() => json(OK));
    expect(await svc.loadVenues([TILE])).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects when every mirror fails instead of pretending there are no pubs', async () => {
    fetchMock.mockImplementation(() => json({}, 504));
    await expect(svc.loadVenues([TILE])).rejects.toThrow();
  });

  it('shares one request between concurrent callers and serves the cache afterwards', async () => {
    fetchMock.mockImplementation(() => json(OK));
    const [a, b] = await Promise.all([svc.loadVenues([TILE]), svc.loadVenues([TILE])]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    await svc.loadVenues([TILE]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a caller aborting does not break the shared request for others', async () => {
    let release!: () => void;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => {
      release = () => resolve(new Response(JSON.stringify(OK)));
    }));
    const ctrl = new AbortController();
    const first = svc.loadVenues([TILE], ctrl.signal);
    const second = svc.loadVenues([TILE]);
    ctrl.abort();
    await expect(first).rejects.toThrow(/Abort/);
    release();
    expect(await second).toHaveLength(1);
  });

  it('skips a failed mirror on the next request', async () => {
    fetchMock.mockImplementationOnce(() => json({}, 429)).mockImplementation(() => json(OK));
    await svc.loadVenues([TILE]);
    const firstMirror = fetchMock.mock.calls[0][0];
    await svc.loadVenues(['962_232']);
    expect(fetchMock.mock.calls[2][0]).not.toBe(firstMirror);
  });
});
