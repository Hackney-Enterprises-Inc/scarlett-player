{{--
  Scarlett Player - Laravel Embed Template

  This template is served at: /v/{id} or /embed/{id}

  Usage in routes/web.php:
  Route::get('/v/{video}', [EmbedController::class, 'show']);
  Route::get('/embed/{event}', [EmbedController::class, 'event']);
--}}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>{{ $title ?? 'Video Player' }}</title>

  {{-- Prevent indexing of embed pages --}}
  <meta name="robots" content="noindex, nofollow">

  {{-- Open Graph for link previews --}}
  @if(isset($poster))
  <meta property="og:image" content="{{ $poster }}">
  @endif
  <meta property="og:title" content="{{ $title ?? 'Video' }}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #player { width: 100%; height: 100%; }
    .error { display: flex; align-items: center; justify-content: center; height: 100%; color: #fff; font-family: system-ui, sans-serif; text-align: center; padding: 20px; }
    .error h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .error p { opacity: 0.7; }
  </style>
</head>
<body>
  <div id="player"></div>

  {{-- Load from CDN in production --}}
  <script src="{{ config('services.scarlett.cdn_url', 'https://cdn.thestreamplatform.com/player') }}/embed.umd.cjs"></script>

  <script>
    // Configuration passed from Laravel controller
    var config = @json([
      'container' => '#player',
      'src' => $src,
      'autoplay' => $autoplay ?? false,
      'muted' => $muted ?? false,
      'poster' => $poster ?? null,
      'controls' => $controls ?? true,
      'brandColor' => $brandColor ?? $tenant->brand_color ?? null,
      'loop' => $loop ?? false,
    ]);

    // Initialize player
    if (config.src) {
      ScarlettPlayer.create(config);
    } else {
      document.body.innerHTML = '<div class="error"><div><h1>Video Not Found</h1><p>This video is unavailable.</p></div></div>';
    }
  </script>
</body>
</html>
