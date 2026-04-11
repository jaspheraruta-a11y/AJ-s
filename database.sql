-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer DEFAULT 0,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.favorite_orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text,
  items jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorite_orders_pkey PRIMARY KEY (id),
  CONSTRAINT favorite_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.inventory (
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  low_stock_threshold integer DEFAULT 10,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (product_id),
  CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid,
  product_id uuid,
  product_name text NOT NULL,
  size text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  addons jsonb DEFAULT '[]'::jsonb,
  notes text,
  line_total numeric NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_number text NOT NULL UNIQUE,
  user_id uuid,
  rider_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::order_status,
  order_type text DEFAULT 'online'::text CHECK (order_type = ANY (ARRAY['walkin'::text, 'online'::text, 'qr'::text])),
  subtotal numeric NOT NULL,
  discount_amount numeric DEFAULT 0,
  promo_code text,
  delivery_fee numeric DEFAULT 0,
  total numeric NOT NULL,
  delivery_address text,
  delivery_notes text,
  customer_notes text,
  table_number text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid,
  method USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  amount numeric NOT NULL,
  reference_number text,
  paid_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.points_history (
  id integer NOT NULL DEFAULT nextval('points_history_id_seq'::regclass),
  user_id integer NOT NULL,
  order_id integer,
  amount_spent numeric,
  points_awarded integer NOT NULL,
  transaction_type text DEFAULT 'earned'::text CHECK (transaction_type = ANY (ARRAY['earned'::text, 'redeemed'::text, 'refunded'::text])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT points_history_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_addons (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid,
  name text NOT NULL,
  price numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  CONSTRAINT product_addons_pkey PRIMARY KEY (id),
  CONSTRAINT product_addons_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_sizes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid,
  name text NOT NULL,
  price_modifier numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  CONSTRAINT product_sizes_pkey PRIMARY KEY (id),
  CONSTRAINT product_sizes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category_id uuid,
  name text NOT NULL,
  slug text,
  description text,
  price numeric NOT NULL,
  image_url text,
  is_available boolean DEFAULT true,
  stock_quantity integer DEFAULT 0,
  has_sizes boolean DEFAULT false,
  has_addons boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  role USER-DEFINED NOT NULL DEFAULT 'client'::user_role,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  points numeric NOT NULL DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.redeemable_products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  stock integer DEFAULT 0,
  max_per_user integer,
  redeemed_count integer DEFAULT 0,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  image_url text,
  CONSTRAINT redeemable_products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sales_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  report_date date NOT NULL UNIQUE,
  total_orders integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  walkin_count integer DEFAULT 0,
  online_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_reports_pkey PRIMARY KEY (id)
);