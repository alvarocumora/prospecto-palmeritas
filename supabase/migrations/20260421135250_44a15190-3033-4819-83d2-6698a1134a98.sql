-- =========================================================
-- property_listings
-- =========================================================
CREATE TABLE public.property_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  code text,
  commodity text NOT NULL,
  country text NOT NULL DEFAULT 'CL',
  region text,
  area_ha numeric,
  stage text NOT NULL DEFAULT 'greenfield', -- greenfield | target | resource | reserve | producing
  modality text NOT NULL DEFAULT 'sale', -- sale | jv | option | earn_in | farm_in
  asking_price_usd numeric,
  royalty_pct numeric,
  summary text,
  geometry_geojson jsonb,
  cover_image_url text,
  data_available text[] DEFAULT '{}', -- assays | drilling | geophysics | ni43101 | dem | ortho
  is_published boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_listings_owner ON public.property_listings(owner_user_id);
CREATE INDEX idx_property_listings_published ON public.property_listings(is_published);
CREATE INDEX idx_property_listings_commodity ON public.property_listings(commodity);
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views published listings" ON public.property_listings
  FOR SELECT TO authenticated
  USING (is_published = true OR owner_user_id = auth.uid());

CREATE POLICY "Owners insert property_listings" ON public.property_listings
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners update property_listings" ON public.property_listings
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners delete property_listings" ON public.property_listings
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

CREATE TRIGGER trg_property_listings_updated
  BEFORE UPDATE ON public.property_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- property_deal_inquiries
-- =========================================================
CREATE TABLE public.property_deal_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
  inquirer_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'inquiry', -- inquiry | nda_signed | due_diligence | loi | closed | withdrawn
  message text,
  nda_signed_at timestamptz,
  nda_ip text,
  nda_signature text,
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, inquirer_user_id)
);
CREATE INDEX idx_property_deal_inquiries_listing ON public.property_deal_inquiries(listing_id);
CREATE INDEX idx_property_deal_inquiries_inquirer ON public.property_deal_inquiries(inquirer_user_id);
ALTER TABLE public.property_deal_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inquirer or owner views inquiries" ON public.property_deal_inquiries
  FOR SELECT TO authenticated
  USING (
    inquirer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.property_listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid())
  );

CREATE POLICY "Inquirer creates inquiry" ON public.property_deal_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (inquirer_user_id = auth.uid());

CREATE POLICY "Inquirer or owner updates inquiry" ON public.property_deal_inquiries
  FOR UPDATE TO authenticated
  USING (
    inquirer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.property_listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid())
  );

CREATE TRIGGER trg_property_deal_inquiries_updated
  BEFORE UPDATE ON public.property_deal_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- property_data_room_files
-- =========================================================
CREATE TABLE public.property_data_room_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  category text DEFAULT 'other',
  requires_nda boolean NOT NULL DEFAULT true,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_data_room_files_listing ON public.property_data_room_files(listing_id);
ALTER TABLE public.property_data_room_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners or NDA-signed inquirers view data_room" ON public.property_data_room_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.property_listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid())
    OR (
      requires_nda = false AND EXISTS (SELECT 1 FROM public.property_listings l WHERE l.id = listing_id AND l.is_published = true)
    )
    OR EXISTS (
      SELECT 1 FROM public.property_deal_inquiries i
      WHERE i.listing_id = property_data_room_files.listing_id
        AND i.inquirer_user_id = auth.uid()
        AND i.nda_signed_at IS NOT NULL
    )
  );

CREATE POLICY "Listing owner uploads data_room" ON public.property_data_room_files
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.property_listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid())
  );

CREATE POLICY "Listing owner deletes data_room" ON public.property_data_room_files
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.property_listings l WHERE l.id = listing_id AND l.owner_user_id = auth.uid()));

-- =========================================================
-- property_deal_messages
-- =========================================================
CREATE TABLE public.property_deal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.property_deal_inquiries(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_deal_messages_inquiry ON public.property_deal_messages(inquiry_id, created_at);
ALTER TABLE public.property_deal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inquiry parties view messages" ON public.property_deal_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.property_deal_inquiries i
      JOIN public.property_listings l ON l.id = i.listing_id
      WHERE i.id = inquiry_id
        AND (i.inquirer_user_id = auth.uid() OR l.owner_user_id = auth.uid())
    )
  );

CREATE POLICY "Inquiry parties post messages" ON public.property_deal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.property_deal_inquiries i
      JOIN public.property_listings l ON l.id = i.listing_id
      WHERE i.id = inquiry_id
        AND (i.inquirer_user_id = auth.uid() OR l.owner_user_id = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.property_deal_messages;

-- =========================================================
-- marketplace_layer_reviews
-- =========================================================
CREATE TABLE public.marketplace_layer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_key text NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(layer_key, user_id)
);
CREATE INDEX idx_marketplace_layer_reviews_layer ON public.marketplace_layer_reviews(layer_key);
ALTER TABLE public.marketplace_layer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views layer_reviews" ON public.marketplace_layer_reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own layer_reviews" ON public.marketplace_layer_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own layer_reviews" ON public.marketplace_layer_reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own layer_reviews" ON public.marketplace_layer_reviews
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_marketplace_layer_reviews_updated
  BEFORE UPDATE ON public.marketplace_layer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Storage bucket: data-room (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-room', 'data-room', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Listing owner reads data-room files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'data-room'
    AND EXISTS (
      SELECT 1 FROM public.property_listings l
      WHERE l.id::text = (storage.foldername(name))[1]
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "NDA-signed inquirer reads data-room files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'data-room'
    AND EXISTS (
      SELECT 1 FROM public.property_deal_inquiries i
      WHERE i.listing_id::text = (storage.foldername(name))[1]
        AND i.inquirer_user_id = auth.uid()
        AND i.nda_signed_at IS NOT NULL
    )
  );

CREATE POLICY "Listing owner uploads data-room files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'data-room'
    AND EXISTS (
      SELECT 1 FROM public.property_listings l
      WHERE l.id::text = (storage.foldername(name))[1]
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Listing owner deletes data-room files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'data-room'
    AND EXISTS (
      SELECT 1 FROM public.property_listings l
      WHERE l.id::text = (storage.foldername(name))[1]
        AND l.owner_user_id = auth.uid()
    )
  );