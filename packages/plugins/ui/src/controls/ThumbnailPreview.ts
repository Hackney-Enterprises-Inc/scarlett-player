/**
 * Thumbnail Preview
 *
 * Renders a thumbnail sprite image at a given time position.
 * Supports sprite sheets where multiple thumbnails are tiled in a single image.
 *
 * Configuration is provided via the player state `thumbnails`:
 * {
 *   src: string;        // URL to the sprite sheet image
 *   width: number;      // Width of each thumbnail tile (px)
 *   height: number;     // Height of each thumbnail tile (px)
 *   columns: number;    // Number of columns in the sprite sheet
 *   interval: number;   // Seconds between each thumbnail
 * }
 */

import { createElement } from '../utils';

export interface ThumbnailConfig {
  /** URL to the sprite sheet image */
  src: string;
  /** Width of each thumbnail tile in pixels */
  width: number;
  /** Height of each thumbnail tile in pixels */
  height: number;
  /** Number of columns in the sprite sheet */
  columns: number;
  /** Seconds between each thumbnail */
  interval: number;
}

export class ThumbnailPreview {
  private el: HTMLDivElement;
  private img: HTMLDivElement;
  private config: ThumbnailConfig | null = null;
  private loaded = false;

  constructor() {
    this.el = createElement('div', { className: 'sp-thumbnail-preview' });

    this.img = createElement('div', { className: 'sp-thumbnail-preview__img' });
    this.el.appendChild(this.img);
  }

  getElement(): HTMLDivElement {
    return this.el;
  }

  setConfig(config: ThumbnailConfig | null): void {
    this.config = config;
    this.loaded = false;

    if (config) {
      this.img.style.width = `${config.width}px`;
      this.img.style.height = `${config.height}px`;
      this.el.style.width = `${config.width}px`;
      this.el.style.height = `${config.height}px`;

      // Preload the sprite sheet
      const preload = new Image();
      preload.onload = () => {
        this.loaded = true;
      };
      preload.src = config.src;
    }
  }

  /**
   * Update the thumbnail to show the frame at the given time.
   * @param time Time in seconds
   * @param percent Position as 0-1 fraction (for horizontal positioning)
   */
  show(time: number, percent: number): void {
    if (!this.config || !this.loaded) {
      this.el.style.display = 'none';
      return;
    }

    const { src, width, height, columns, interval } = this.config;
    const index = Math.floor(time / interval);
    const col = index % columns;
    const row = Math.floor(index / columns);

    this.img.style.backgroundImage = `url(${src})`;
    this.img.style.backgroundPosition = `-${col * width}px -${row * height}px`;
    this.img.style.backgroundSize = `${columns * width}px auto`;
    this.img.style.width = `${width}px`;
    this.img.style.height = `${height}px`;

    // Position horizontally, clamped to parent bounds
    this.el.style.left = `${percent * 100}%`;
    this.el.style.display = '';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  destroy(): void {
    this.el.remove();
  }
}
