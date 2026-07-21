import React from "react";

export interface ResponsiveImageSource {
  /** e.g. "/data/thrive-480.webp 480w, /data/thrive-800.webp 800w, /data/thrive.webp 900w" */
  srcSet: string;
  type?: string;
}

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sources?: ResponsiveImageSource[];
  sizes?: string;
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  style?: React.CSSProperties;
}

/**
 * Thin wrapper around <picture>/<img> so every image on the site carries
 * fixed dimensions (CLS), async decoding, and an explicit loading strategy
 * instead of each call site re-deriving that boilerplate. `fetchPriority`
 * defaults to unset -- only the real LCP candidate should opt into "high".
 */
export function ResponsiveImage({
  src,
  alt,
  width,
  height,
  sources = [],
  sizes,
  className,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  style,
}: ResponsiveImageProps) {
  const img = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      sizes={sources.length ? sizes : undefined}
      style={style}
    />
  );

  if (!sources.length) return img;

  return (
    <picture>
      {sources.map((source) => (
        <source key={source.srcSet} srcSet={source.srcSet} sizes={sizes} type={source.type ?? "image/webp"} />
      ))}
      {img}
    </picture>
  );
}

/**
 * Builds a srcSet for the /data/<name>[-<width>].webp convention produced by
 * scripts/optimize-images.mjs: `<name>.webp` is the ~900px-wide master, plus
 * optional `<name>-480.webp` / `<name>-800.webp` narrower variants.
 */
export function buildDataAssetSrcSet(basePath: string, fullWidth: number, narrowerWidths: number[] = [480, 800]): string {
  const dot = basePath.lastIndexOf(".");
  const base = basePath.slice(0, dot);
  const ext = basePath.slice(dot);
  const entries = narrowerWidths
    .filter((w) => w < fullWidth)
    .map((w) => `${base}-${w}${ext} ${w}w`);
  entries.push(`${basePath} ${fullWidth}w`);
  return entries.join(", ");
}
