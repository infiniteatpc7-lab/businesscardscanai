import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage PWA "Add to Home Screen" shortcut installation.
 * Supports native Android/Chrome 1-tap prompts and iOS Safari instruction guidance.
 */
export function usePwaInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);
    const [isBannerDismissed, setIsBannerDismissed] = useState(false);

    useEffect(() => {
        // Detect if already running in standalone app mode (added to home screen)
        const checkStandalone = () => {
            const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
            const iOSStandalone = window.navigator.standalone === true;
            return standaloneMedia || iOSStandalone;
        };

        setIsStandalone(checkStandalone());

        // Detect iOS devices (iPhone, iPad, iPod)
        const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(checkIOS);

        // Check if banner was dismissed recently
        const dismissed = localStorage.getItem('pwa_banner_dismissed');
        if (dismissed) {
            setIsBannerDismissed(true);
        }

        // Check if beforeinstallprompt was already captured early in window
        if (window.deferredPwaPrompt) {
            setDeferredPrompt(window.deferredPwaPrompt);
        }

        // Capture native browser install prompt (Android, Chrome, Edge)
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            window.deferredPwaPrompt = e;
            setDeferredPrompt(e);
        };

        const handlePromptReady = () => {
            if (window.deferredPwaPrompt) {
                setDeferredPrompt(window.deferredPwaPrompt);
            }
        };

        const handleAppInstalled = () => {
            setIsStandalone(true);
            setDeferredPrompt(null);
            window.deferredPwaPrompt = null;
            localStorage.removeItem('pwa_banner_dismissed');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('pwa-prompt-ready', handlePromptReady);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('pwa-prompt-ready', handlePromptReady);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const triggerInstall = useCallback(async () => {
        const promptEvent = deferredPrompt || window.deferredPwaPrompt;

        if (promptEvent) {
            try {
                await promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                if (choice.outcome === 'accepted') {
                    setDeferredPrompt(null);
                    window.deferredPwaPrompt = null;
                }
            } catch (err) {
                console.debug('PWA prompt error:', err);
                setIsIOSModalOpen(true);
            }
        } else {
            // Fallback: iOS Safari or browsers/origins where beforeinstallprompt is restricted (e.g. non-HTTPS local IP)
            setIsIOSModalOpen(true);
        }
    }, [deferredPrompt]);

    const dismissBanner = useCallback(() => {
        setIsBannerDismissed(true);
        try {
            localStorage.setItem('pwa_banner_dismissed', 'true');
        } catch {}
    }, []);

    return {
        isStandalone,
        canInstall: !isStandalone,
        isIOS,
        isIOSModalOpen,
        setIsIOSModalOpen,
        triggerInstall,
        isBannerDismissed,
        dismissBanner,
    };
}
