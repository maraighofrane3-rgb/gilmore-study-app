import { useState, useEffect } from 'react';

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone
    ) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return false;

    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;

    setInstallEvent(null);

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    return outcome === 'accepted';
  };

  return {
    canInstall: !!installEvent,
    isInstalled,
    install,
  };
}