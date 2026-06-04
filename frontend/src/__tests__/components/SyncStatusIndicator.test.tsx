import { fireEvent, render, screen } from '@testing-library/react';
import type { SyncStatus } from '../../components/FavoritesSyncManager';
import SyncStatusIndicator from '../../components/SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  const onRetry = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['idle', 'Favorites synced'],
    ['synced', 'Favorites synced'],
  ] as [SyncStatus, string][])('renders checkmark with aria-label for %s status', (status, ariaLabel) => {
    render(<SyncStatusIndicator status={status} onRetry={onRetry} />);

    const region = screen.getByText(ariaLabel);
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders spinner with aria-label for syncing status', () => {
    render(<SyncStatusIndicator status="syncing" onRetry={onRetry} />);

    const region = screen.getByText('Syncing favorites');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders warning icon with aria-label for error status', () => {
    render(<SyncStatusIndicator status="error" onRetry={onRetry} />);

    const regions = screen.getAllByText('Sync failed');
    expect(regions.length).toBeGreaterThanOrEqual(1);
    const liveRegion = regions.find((el) => el.getAttribute('aria-live') === 'polite');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('renders retry button when status is error', () => {
    render(<SyncStatusIndicator status="error" onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry sync/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders offline icon with aria-label for offline status', () => {
    render(<SyncStatusIndicator status="offline" onRetry={onRetry} />);

    const region = screen.getByText('Offline — favorites saved locally');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-live="polite" region for screen reader announcements', () => {
    render(<SyncStatusIndicator status="synced" onRetry={onRetry} />);

    const liveRegion = screen.getAllByText('Favorites synced').find(
      (el) => el.getAttribute('aria-live') === 'polite'
    );
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveClass('sr-only');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
