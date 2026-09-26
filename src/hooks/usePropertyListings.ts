// Hook to fetch property marketplace listings (mining concessions / royalties / JVs).
// Public listings are visible to all authenticated users; owners see their drafts too.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listDataRoomFiles } from "@/lib/dataRoom.functions";

export interface PropertyListing {
  id: string;
  owner_user_id: string;
  project_id: string | null;
  title: string;
  code: string | null;
  commodity: string;
  country: string;
  region: string | null;
  area_ha: number | null;
  stage: string;
  modality: string;
  asking_price_usd: number | null;
  royalty_pct: number | null;
  summary: string | null;
  geometry_geojson: unknown;
  cover_image_url: string | null;
  data_available: string[];
  is_published: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface DataRoomFile {
  id: string;
  listing_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  category: string | null;
  requires_nda: boolean;
  pending?: boolean;
  created_at: string;
}

export interface DealInquiry {
  id: string;
  listing_id: string;
  inquirer_user_id: string;
  status: string;
  stage?: string | null;
  stage_updated_at?: string | null;
  message: string | null;
  nda_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function usePropertyListings(projectId?: string | null) {
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("property_listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      console.error("[usePropertyListings]", error);
      return;
    }
    setListings((data ?? []) as PropertyListing[]);
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { listings, loading, refresh: fetch };
}

export function usePropertyListing(id: string | null) {
  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [files, setFiles] = useState<DataRoomFile[]>([]);
  const [inquiry, setInquiry] = useState<DealInquiry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!id) {
      setListing(null);
      setFiles([]);
      setInquiry(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    const [{ data: l }, dataRoomFiles, { data: i }] = await Promise.all([
      supabase.from("property_listings").select("*").eq("id", id).maybeSingle(),
      // Data room canónico (data_rooms del proyecto) vía server function
      uid
        ? listDataRoomFiles({ data: { listingId: id } }).catch(() => [] as DataRoomFile[])
        : Promise.resolve([] as DataRoomFile[]),
      uid
        ? supabase
            .from("property_deal_inquiries")
            .select("*")
            .eq("listing_id", id)
            .eq("inquirer_user_id", uid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setListing((l as PropertyListing) ?? null);
    setFiles(dataRoomFiles as DataRoomFile[]);
    setInquiry((i as DealInquiry) ?? null);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { listing, files, inquiry, loading, refresh: fetchAll };
}
