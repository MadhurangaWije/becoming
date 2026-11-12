import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUi } from '@/app/uiStore';
import { InstallCard, IosInstallFirst, installEnv } from '@/components/Install';

const UA = {
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
};

const setUa = (ua: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  useUi.setState({ installPrompt: null });
});

describe('installEnv', () => {
  it('detects iOS browsers', () => {
    setUa(UA.iosChrome);
    expect(installEnv()).toMatchObject({ ios: true, iosBrowser: 'chrome', standalone: false });
    setUa(UA.iosSafari);
    expect(installEnv().iosBrowser).toBe('safari');
    setUa(UA.android);
    expect(installEnv().ios).toBe(false);
  });
});

describe('InstallCard', () => {
  it('on iOS Chrome, points to the Share icon in the address bar', () => {
    setUa(UA.iosChrome);
    render(<InstallCard />);
    expect(screen.getByText(/right end of the address bar/)).toBeInTheDocument();
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument();
  });

  it('on iOS Safari, points to the bottom toolbar', () => {
    setUa(UA.iosSafari);
    render(<InstallCard />);
    expect(screen.getByText(/bottom toolbar/)).toBeInTheDocument();
  });

  it('on Android, shows nothing until Chrome offers install, then a real Install button', async () => {
    setUa(UA.android);
    const { container } = render(<InstallCard />);
    expect(container).toBeEmptyDOMElement();
    const prompt = vi.fn().mockResolvedValue(undefined);
    act(() => useUi.setState({ installPrompt: Object.assign(new Event('beforeinstallprompt'), { prompt }) }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalled();
    expect(useUi.getState().installPrompt).toBeNull();
  });

  it('stays dismissed', async () => {
    setUa(UA.iosChrome);
    const { unmount } = render(<InstallCard />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss install card' }));
    expect(screen.queryByText('Install Becoming')).not.toBeInTheDocument();
    unmount();
    render(<InstallCard />);
    expect(screen.queryByText('Install Becoming')).not.toBeInTheDocument();
  });

  it('hides when already installed', () => {
    setUa(UA.iosChrome);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    const { container } = render(<InstallCard />);
    expect(container).toBeEmptyDOMElement();
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  });
});

describe('IosInstallFirst', () => {
  it('shows on iOS only', () => {
    setUa(UA.iosChrome);
    const { unmount } = render(<IosInstallFirst />);
    expect(screen.getByText('Install first')).toBeInTheDocument();
    unmount();
    setUa(UA.android);
    const { container } = render(<IosInstallFirst />);
    expect(container).toBeEmptyDOMElement();
  });
});
