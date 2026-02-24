-- NEER Database Initialization
-- Run this script in the Supabase SQL Editor.

-- 1. Create the `users` table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY, -- Maps to auth.users.id
  phone TEXT UNIQUE,    -- Nullable for Google users
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  village TEXT,
  district TEXT,
  state TEXT,
  primary_crop TEXT,
  land_size FLOAT,
  profile_complete BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the `posts` table (Community Feed)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY,
  author TEXT NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  target_crop TEXT,
  type TEXT,
  likes INTEGER DEFAULT 0,
  liked_by UUID[] DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create the `comments` table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create the `bids` table (Mandi)
CREATE TABLE IF NOT EXISTS public.bids (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  amount FLOAT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set permissions
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write access to bids" ON public.bids FOR ALL USING (true) WITH CHECK (true);
