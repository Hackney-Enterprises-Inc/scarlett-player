<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Video;
use Illuminate\Http\Request;

/**
 * Example Laravel Controller for Scarlett Player iframe embeds
 *
 * Routes (add to routes/web.php):
 *   Route::get('/v/{video:uuid}', [EmbedController::class, 'video']);
 *   Route::get('/embed/{event:slug}', [EmbedController::class, 'event']);
 *   Route::get('/live/{channel}', [EmbedController::class, 'live']);
 */
class EmbedController extends Controller
{
    /**
     * Embed a video by UUID
     * URL: /v/abc123
     * iframe: <iframe src="https://embed.thestreamplatform.com/v/abc123"></iframe>
     */
    public function video(Video $video)
    {
        // Check if video is publicly embeddable
        if (!$video->embeddable) {
            abort(403, 'This video cannot be embedded');
        }

        return view('embed.player', [
            'src' => $video->stream_url,
            'title' => $video->title,
            'poster' => $video->thumbnail_url,
            'autoplay' => request()->boolean('autoplay'),
            'muted' => request()->boolean('muted', request()->boolean('autoplay')),
            'controls' => request()->boolean('controls', true),
            'brandColor' => $video->tenant->brand_color,
            'tenant' => $video->tenant,
        ]);
    }

    /**
     * Embed a live event by slug
     * URL: /embed/fight-night-2025
     * iframe: <iframe src="https://embed.thestreamplatform.com/embed/fight-night-2025"></iframe>
     */
    public function event(Event $event)
    {
        // Check event access
        if (!$event->is_public && !$event->isAccessibleBy(auth()->user())) {
            abort(403, 'Access denied');
        }

        return view('embed.player', [
            'src' => $event->live_stream_url ?? $event->replay_url,
            'title' => $event->title,
            'poster' => $event->poster_url,
            'autoplay' => $event->is_live, // Auto-play live events
            'muted' => $event->is_live,    // Muted for autoplay compliance
            'controls' => true,
            'brandColor' => $event->tenant->brand_color,
            'tenant' => $event->tenant,
        ]);
    }

    /**
     * Embed a live channel
     * URL: /live/sports-channel
     */
    public function live(string $channel)
    {
        // Look up channel and get current stream
        $stream = LiveChannel::where('slug', $channel)
            ->where('is_active', true)
            ->firstOrFail();

        return view('embed.player', [
            'src' => $stream->hls_url,
            'title' => $stream->name . ' - Live',
            'poster' => $stream->thumbnail_url,
            'autoplay' => true,
            'muted' => true,
            'controls' => true,
            'brandColor' => $stream->tenant->brand_color,
            'tenant' => $stream->tenant,
        ]);
    }
}
