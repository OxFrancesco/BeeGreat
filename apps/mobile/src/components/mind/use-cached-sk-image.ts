import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

/**
 * Module-level SkImage cache for the Mind grids.
 *
 * Skia's `useImage` refetches and re-decodes on every mount, so hex cells
 * visibly reloaded whenever the list remounted (view/column switches, tab
 * revisits, virtualization). Decoded bitmaps are cached here for the app
 * session instead, downscaled so a screenful of og:image banners stays cheap.
 */
const MAX_CACHE_ENTRIES = 96;
const MAX_IMAGE_DIMENSION = 512;

const cache = new Map<string, SkImage | null>();
const pending = new Map<string, Promise<SkImage | null>>();

function remember(key: string, image: SkImage | null) {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, image);
}

function downscale(image: SkImage, maxDimension: number): SkImage {
  const width = image.width();
  const height = image.height();
  const scale = maxDimension / Math.max(width, height);
  if (scale >= 1) return image;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const surface = Skia.Surface.Make(targetWidth, targetHeight);
  if (!surface) return image;
  surface
    .getCanvas()
    .drawImageRect(
      image,
      Skia.XYWHRect(0, 0, width, height),
      Skia.XYWHRect(0, 0, targetWidth, targetHeight),
      Skia.Paint(),
    );
  const scaled = surface.makeImageSnapshot().makeNonTextureImage();
  surface.dispose();
  return scaled ?? image;
}

async function loadImage(url: string, maxDimension: number): Promise<SkImage | null> {
  try {
    const data = await Skia.Data.fromURI(url);
    const image = Skia.Image.MakeImageFromEncoded(data);
    data.dispose();
    if (!image) return null;
    const scaled = downscale(image, maxDimension);
    if (scaled !== image) image.dispose();
    return scaled;
  } catch {
    return null;
  }
}

function fetchImage(url: string) {
  const cached = cache.get(url);
  if (cached !== undefined) return { cached, promise: undefined };
  let promise = pending.get(url);
  if (!promise) {
    promise = loadImage(url, MAX_IMAGE_DIMENSION).then((image) => {
      remember(url, image);
      pending.delete(url);
      return image;
    });
    pending.set(url, promise);
  }
  return { cached: undefined, promise };
}

/**
 * Resolves the first candidate URL that decodes successfully. Extra
 * candidates act as fallbacks (e.g. a favicon service when the scraped
 * favicon is missing or in a format Skia cannot decode, like .ico).
 */
export function useCachedSkImage(
  ...candidates: (string | null | undefined)[]
): SkImage | null {
  const urls = candidates.filter((url): url is string => Boolean(url));
  const dependencyKey = urls.join('\n');
  const [image, setImage] = useState<SkImage | null>(() => {
    for (const url of urls) {
      const cached = cache.get(url);
      if (cached) return cached;
    }
    return null;
  });

  useEffect(() => {
    const candidateUrls = dependencyKey ? dependencyKey.split('\n') : [];
    let cancelled = false;
    (async () => {
      for (const url of candidateUrls) {
        const { cached, promise } = fetchImage(url);
        const resolved = cached !== undefined ? cached : await promise;
        if (cancelled) return;
        if (resolved) {
          setImage(resolved);
          return;
        }
      }
      if (!cancelled) setImage(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [dependencyKey]);

  return image;
}
