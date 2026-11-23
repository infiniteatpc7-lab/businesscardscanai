<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full bg-[#F4F4F6]">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>CardScan AI — Next-Gen Multilingual Business Card Reader</title>

    <!-- Progressive Web App (PWA) & Mobile Home Screen Metadata -->
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="#111115">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="CardScan AI">
    <link rel="apple-touch-icon" href="/icon-192.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">

    <!-- Early PWA beforeinstallprompt capture -->
    <script>
        window.deferredPwaPrompt = null;
        window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.deferredPwaPrompt = e;
            window.dispatchEvent(new Event('pwa-prompt-ready'));
        });
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Noto+Sans+Gujarati:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- Preload Hero Banner Media for Instant Playback -->
    <link rel="preload" as="image" href="/images/business-exhibition-banner.webp" type="image/webp" fetchpriority="high">
    <link rel="preload" as="video" href="/images/animatebanner.mp4" type="video/mp4">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/main.jsx'])
</head>
<body class="min-h-full font-sans antialiased bg-[#F4F4F6] text-[#111115] selection:bg-[#111115] selection:text-white">
    <div id="app"></div>
</body>
</html>
