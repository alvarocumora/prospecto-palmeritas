import { fromUrl } from "geotiff";
import type { BandSample } from "@/lib/remote-sensing/anomalyEngine";

export type SentinelAssets = {
  b02:string; b04:string; b08:string; b11:string; b12:string;
};
export type Wgs84Point={lat:number;lng:number};

async function sampleAsset(url:string, point:Wgs84Point):Promise<number>{
  const tiff=await fromUrl(url); const image=await tiff.getImage();
  const [ox,oy]=image.getOrigin(); const [rx,ry]=image.getResolution();
  const x=Math.floor((point.lng-ox)/rx); const y=Math.floor((point.lat-oy)/ry);
  if(x<0||y<0||x>=image.getWidth()||y>=image.getHeight()) throw new Error("POINT_OUTSIDE_RASTER");
  const raster=await image.readRasters({window:[x,y,x+1,y+1]});
  const value=Number(raster[0][0]); if(!Number.isFinite(value)) throw new Error("INVALID_RASTER_VALUE");
  return value;
}

/**
 * Samples analysis-ready COG assets at a WGS84 point.
 * Asset URLs must be readable/signed by the upstream STAC provider.
 */
export async function sampleSentinelBands(assets:SentinelAssets,point:Wgs84Point):Promise<BandSample>{
  const [b02,b04,b08,b11,b12]=await Promise.all([
    sampleAsset(assets.b02,point),sampleAsset(assets.b04,point),sampleAsset(assets.b08,point),sampleAsset(assets.b11,point),sampleAsset(assets.b12,point),
  ]);
  return {b02,b04,b08,b11,b12};
}
