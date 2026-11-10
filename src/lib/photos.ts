import type { ImageMetadata } from 'astro';

// Toutes les photos de src/assets/photos, indexées par nom de fichier.
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

export const photos: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [path.split('/').pop()!, mod.default]),
);

export function photo(name: string): ImageMetadata {
  const img = photos[name];
  if (!img) throw new Error(`Photo introuvable : "${name}" (attendue dans src/assets/photos/)`);
  return img;
}
