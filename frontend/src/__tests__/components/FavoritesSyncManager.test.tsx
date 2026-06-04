import { act, renderHook, waitFor } from '@testing-library/react';

const STORAGE_KEY = 'template-library-favorites';

let mockIsAuthenticated = false;
let mockWalletAddress: string | null = null;
let remoteFavorites: string[] = [];
let remoteOk = true;
let postBody: { favorites: string[] } | null = null;

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

jest.mock('../../hooks/useFreighterWallet', () => ({
  useFreighterWallet: () => ({ address: mockWalletAddress }),
}));

function mockResponse(data: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

const mockFetch = jest.fn();

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();

  mockIsAuthenticated = false;
  mockWalletAddress = null;
  remoteFavorites = [];
  remoteOk = true;
  postBody = null;
  mockFetch.mockReset();

  mockFetch.mockImplementation(async (url, opts) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr === '/api/favorites' && (!opts || !opts.method || opts.method === 'GET')) {
      return mockResponse(
        { favorites: remoteFavorites, updatedAt: new Date().toISOString() },
        remoteOk ? 200 : 500
      );
    }

    if (urlStr === '/api/favorites' && opts?.method === 'POST') {
      postBody = opts.body ? JSON.parse(opts.body as string) : null;
      return mockResponse(null, remoteOk ? 200 : 500);
    }

    return mockResponse(null, 404);
  });

  global.fetch = mockFetch;
});

afterEach(() => {
  delete (global as any).fetch;
  jest.useRealTimers();
});

function useFavoritesHook() {
  const { useFavorites } = require('../../components/FavoritesSyncManager');
  return useFavorites();
}

describe('useFavorites', () => {
  it('loads from localStorage immediately on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b']));
    const { result } = renderHook(() => useFavoritesHook());
    expect(result.current.favorites).toEqual(['a', 'b']);
    expect(result.current.syncStatus).toBe('offline');
  });

  it('fetches from API when authenticated and merges using union logic', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['A', 'B']));
    remoteFavorites = ['B', 'C'];
    mockIsAuthenticated = true;
    mockWalletAddress = 'GABCDEF';

    const { result } = renderHook(() => useFavoritesHook());

    await waitFor(() => {
      expect(result.current.favorites).toContain('C');
    });

    expect(result.current.favorites).toEqual(['A', 'B', 'C']);
  });

  it('conflict resolution: local [A,B], remote [B,C] → merged [A,B,C]', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['A', 'B']));
    remoteFavorites = ['B', 'C'];
    mockIsAuthenticated = true;
    mockWalletAddress = 'GABCDEF';

    const { result } = renderHook(() => useFavoritesHook());

    await waitFor(() => {
      expect(result.current.favorites).toEqual(['A', 'B', 'C']);
    });
  });

  it('toggleFavorite adds a new id and triggers a debounced sync', async () => {
    mockIsAuthenticated = true;
    mockWalletAddress = 'GABCDEF';

    const { result } = renderHook(() => useFavoritesHook());

    await waitFor(() => {
      expect(result.current.syncStatus).not.toBe('idle');
    });

    act(() => {
      result.current.toggleFavorite('new-id');
    });

    expect(result.current.favorites).toContain('new-id');

    await waitFor(
      () => {
        expect(postBody).toEqual({ favorites: ['new-id'] });
      },
      { timeout: 5000 }
    );
  });

  it('toggleFavorite removes an existing id and triggers a debounced sync', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['keep', 'remove']));
    mockIsAuthenticated = true;
    mockWalletAddress = 'GABCDEF';

    const { result } = renderHook(() => useFavoritesHook());

    await waitFor(() => {
      expect(result.current.syncStatus).not.toBe('idle');
    });

    act(() => {
      result.current.toggleFavorite('remove');
    });

    expect(result.current.favorites).toEqual(['keep']);

    await waitFor(
      () => {
        expect(postBody).toEqual({ favorites: ['keep'] });
      },
      { timeout: 5000 }
    );
  });

  it('API failure keeps local state intact and sets syncStatus to error', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['local-only']));
    remoteOk = false;
    mockIsAuthenticated = true;
    mockWalletAddress = 'GABCDEF';

    const { result } = renderHook(() => useFavoritesHook());

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error');
    });

    expect(result.current.favorites).toEqual(['local-only']);
  });

  it('unauthenticated user gets localStorage-only behavior with no API calls', () => {
    mockIsAuthenticated = false;

    renderHook(() => useFavoritesHook());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('toggleFavorite triggers sync with synced status', async () => {
    mockIsAuthenticated = true;
    mockWalletAddress = 'GABCDEF';

    const { result } = renderHook(() => useFavoritesHook());

    await waitFor(() => {
      expect(result.current.syncStatus).not.toBe('idle');
    });

    act(() => {
      result.current.toggleFavorite('x');
    });

    await waitFor(
      () => {
        expect(result.current.syncStatus).toBe('synced');
      },
      { timeout: 5000 }
    );
  });
});
