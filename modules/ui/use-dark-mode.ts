/**
 * Dark mode hook.
 * Reads from settings storage and applies .dark class to document.
 */

import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read initial setting
    chrome.storage.local.get('tl_settings', (result) => {
      const settings = result.tl_settings as { darkMode?: boolean } | undefined;
      const dark = settings?.darkMode ?? false;
      setIsDark(dark);
      applyDarkMode(dark);
    });

    // Listen for changes
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && changes.tl_settings) {
        const newSettings = changes.tl_settings.newValue as {
          darkMode?: boolean;
        } | undefined;
        const dark = newSettings?.darkMode ?? false;
        setIsDark(dark);
        applyDarkMode(dark);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return isDark;
}

function applyDarkMode(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
