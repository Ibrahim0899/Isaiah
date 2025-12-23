-- =============================================
-- Isaiah V2 - Multi-Writer Database Setup
-- Execute this SQL in Supabase SQL Editor
-- =============================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'writer' CHECK (role IN ('admin', 'writer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add author_id to writings table
ALTER TABLE writings ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id);

-- 3. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Update RLS for writings
DROP POLICY IF EXISTS "Allow all updates" ON writings;
DROP POLICY IF EXISTS "Anyone can view public writings" ON writings;
DROP POLICY IF EXISTS "Authors can view own writings" ON writings;
DROP POLICY IF EXISTS "Authors can create writings" ON writings;
DROP POLICY IF EXISTS "Authors can update own writings" ON writings;
DROP POLICY IF EXISTS "Authors can delete own writings" ON writings;

CREATE POLICY "Anyone can view public writings" ON writings
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "Authors can view own writings" ON writings
  FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Authors can create writings" ON writings
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own writings" ON writings
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own writings" ON writings
  FOR DELETE USING (auth.uid() = author_id);

-- 6. Create function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Admin policies - Admins can manage all writings
CREATE POLICY "Admins can view all writings" ON writings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all writings" ON writings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete all writings" ON writings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 9. Set you (Ibrahima) as admin - run this AFTER creating your account
-- UPDATE profiles SET role = 'admin' WHERE username = 'YOUR_USERNAME';

-- =============================================
-- 10. Newsletter Subscriptions Table
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- Enable RLS on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe" ON subscriptions
  FOR INSERT WITH CHECK (true);

-- Only admins can view subscriptions
CREATE POLICY "Admins can view subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update subscriptions
CREATE POLICY "Admins can update subscriptions" ON subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);

-- =============================================
-- Isaiah V3 - Subscription & Views System
-- =============================================

-- 11. Add view_count to writings
ALTER TABLE writings ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 12. Create follows table (user subscriptions to writers)
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS on follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Users can see their own follows
CREATE POLICY "Users can view own follows" ON follows
  FOR SELECT USING (auth.uid() = follower_id);

-- Users can follow/unfollow
CREATE POLICY "Users can follow" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- 13. Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(writing_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE writings SET view_count = view_count + 1 WHERE id = writing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_writings_author ON writings(author_id);

-- 15. Get follower count for a profile
CREATE OR REPLACE FUNCTION get_follower_count(profile_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM follows WHERE following_id = profile_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Check if user follows another
CREATE OR REPLACE FUNCTION is_following(follower UUID, following UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM follows WHERE follower_id = follower AND following_id = following);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
