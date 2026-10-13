import { SENTINEL_BANDS, type SentinelBand, type SentinelRasterScene } from "./sentinelRaster";
const STAC =
  "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/";
const SIGN = "https://planetarycomputer.microsoft.com/api/sas/v1/sign";
export function trustedSentinelAsset(href: string) {
  const url = new URL(href);
  if (
    url.protocol !== "https:" ||
    !/^sentinel2l2a\d+\.blob\.core\.windows\.net$/.test(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("UNTRUSTED_SENTINEL_ASSET");
  return url.toString();
}
async function signAsset(href: string, signal: AbortSignal) {
  trustedSentinelAsset(href);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${SIGN}?href=${encodeURIComponent(href)}`, { signal });
    if (response.ok) {
      const data = (await response.json()) as { href?: string };
      if (!data.href) throw new Error("MISSING_ASSET_SIGNATURE");
      return trustedSentinelAsset(data.href);
    }
    if (response.status !== 429 && response.status < 500)
      throw new Error(`SIGN_${response.status}`);
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error("SIGN_SERVICE_UNAVAILABLE");
}
/** Reads the product's actual radiometry; never infers offset from acquisition date. */
export function parseSentinelRadiometry(xml: string, baseline: string) {
  const quantification = Number(
    xml.match(/<BOA_QUANTIFICATION_VALUE\b[^>]*>([^<]+)<\/BOA_QUANTIFICATION_VALUE>/)?.[1],
  );
  if (!Number.isFinite(quantification) || quantification <= 0)
    throw new Error("MISSING_BOA_QUANTIFICATION");
  const offsets = new Map<number, number>();
  for (const match of xml.matchAll(
    /<BOA_ADD_OFFSET\b[^>]*band_id=["'](\d+)["'][^>]*>([^<]+)<\/BOA_ADD_OFFSET>/g,
  ))
    offsets.set(Number(match[1]), Number(match[2]));
  const ids: Record<Exclude<SentinelBand, "SCL"> | "B03", number> = {
    B02: 1,
    B03: 2,
    B04: 3,
    B08: 7,
    B11: 11,
    B12: 12,
  };
  const version = Number(baseline);
  if (!Number.isFinite(version)) throw new Error("UNKNOWN_PROCESSING_BASELINE");
  return Object.fromEntries(
    Object.entries(ids).map(([key, id]) => {
      const offset = offsets.get(id) ?? (version < 4 ? 0 : NaN);
      if (!Number.isFinite(offset)) throw new Error(`MISSING_BOA_OFFSET_${key}`);
      return [key, { scale: 1 / quantification, offset: offset / quantification, nodata: 0 }];
    }),
  ) as Record<
    Exclude<SentinelBand, "SCL"> | "B03",
    { scale: number; offset: number; nodata: number }
  >;
}
export async function loadSentinelRasterScene(
  id: string,
  signal: AbortSignal,
): Promise<SentinelRasterScene> {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new Error("INVALID_SCENE_ID");
  const stacHref = STAC + encodeURIComponent(id);
  const response = await fetch(stacHref, { signal });
  if (!response.ok) throw new Error(`SCENE_${response.status}`);
  const item = (await response.json()) as {
    id?: string;
    collection?: string;
    properties?: Record<string, unknown>;
    assets?: Record<string, { href?: string }>;
  };
  if (item.id !== id || item.collection !== "sentinel-2-l2a")
    throw new Error("SCENE_IDENTITY_MISMATCH");
  const datetime = String(item.properties?.datetime ?? "");
  if (!datetime || !Number.isFinite(Date.parse(datetime)))
    throw new Error("MISSING_ACQUISITION_DATE");
  const metadataHref = item.assets?.["product-metadata"]?.href;
  if (!metadataHref) throw new Error("MISSING_PRODUCT_METADATA");
  const signedMetadata = await signAsset(metadataHref, signal);
  const xmlResponse = await fetch(signedMetadata, { signal });
  if (!xmlResponse.ok) throw new Error("PRODUCT_METADATA_UNAVAILABLE");
  const radiometry = parseSentinelRadiometry(
    await xmlResponse.text(),
    String(item.properties?.["s2:processing_baseline"] ?? ""),
  );
  const assets = {} as SentinelRasterScene["assets"];
  for (const band of SENTINEL_BANDS) {
    const href = item.assets?.[band]?.href;
    if (!href) throw new Error(`MISSING_BAND_${band}`);
    assets[band] = {
      href: await signAsset(href, signal),
      ...(band === "SCL" ? { scale: 1, offset: 0, nodata: 0 } : radiometry[band]),
    };
  }
  const greenHref = item.assets?.B03?.href;
  if (!greenHref) throw new Error("MISSING_BAND_B03");
  assets.B03 = {
    href: await signAsset(greenHref, signal),
    ...radiometry.B03,
  };
  return {
    id,
    datetime,
    stacHref,
    cloudPct:
      typeof item.properties?.["eo:cloud_cover"] === "number"
        ? item.properties["eo:cloud_cover"]
        : null,
    assets,
  };
}
