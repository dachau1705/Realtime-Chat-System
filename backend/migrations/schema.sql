-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255), -- NULL for 1-to-1 chats
    is_group BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Conversation members table (junction table)
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

-- 4. Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    content TEXT NOT NULL,
    client_message_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) DEFAULT 'text' NOT NULL,
    media_url VARCHAR(1024) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Message receipts table
CREATE TABLE IF NOT EXISTS message_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) DEFAULT 'sent' NOT NULL, -- 'sent', 'delivered', 'seen'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_message_user_receipt UNIQUE (message_id, user_id)
);

-- Indexes for scaling and fast retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_client_message_id ON messages(client_message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_user_status ON message_receipts(user_id, status);

-- Add type and media_url to messages table if they don't exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'text' NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url VARCHAR(1024) NULL;

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
    user_id_1 UUID REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id_1, user_id_2)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_1 ON friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendships_user_2 ON friendships(user_id_2);

-- Alter users table to add advanced profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url VARCHAR(1024) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_is_public BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS about_info JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 6. Follows table
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_follower_following UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 7. Posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NULL,
    media_urls TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    visibility VARCHAR(20) DEFAULT 'public' NOT NULL,
    allowed_user_ids UUID[] DEFAULT '{}'::UUID[] NOT NULL,
    blocked_user_ids UUID[] DEFAULT '{}'::UUID[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- 8. Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC);

-- 9. Reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) DEFAULT 'like' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_post_user_reaction UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);

-- 10. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(30) NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NULL,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 11. Stories table (Facebook-style stories expiring in 24 hours)
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    media_url VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stories_user_expires ON stories(user_id, expires_at DESC);

-- 12. Page Categories table
CREATE TABLE IF NOT EXISTS page_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed basic categories if not exists
INSERT INTO page_categories (name, slug, description) VALUES
('Business', 'business', 'Organizations, startups, corporate offices'),
('Company', 'company', 'Regional companies, enterprise networks'),
('Brand', 'brand', 'Apparel, merchandise, digital products'),
('Public Figure', 'public-figure', 'Creators, public figures, artists'),
('Community', 'community', 'Discussion hubs, public groups, forums'),
('Local Store', 'local-store', 'Cafes, supermarkets, physical boutiques')
ON CONFLICT (name) DO NOTHING;

-- 13. Pages table
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    page_name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    category_id INT REFERENCES page_categories(id) NOT NULL,
    description TEXT,
    phone VARCHAR(30),
    email VARCHAR(100),
    website VARCHAR(255),
    location VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    avatar VARCHAR(1024),
    cover_photo VARCHAR(1024),
    verification_status VARCHAR(20) DEFAULT 'unverified' NOT NULL, -- 'unverified', 'pending', 'verified', 'rejected'
    visibility VARCHAR(20) DEFAULT 'public' NOT NULL, -- 'public', 'private', 'hidden'
    followers_count INT DEFAULT 0 NOT NULL,
    likes_count INT DEFAULT 0 NOT NULL,
    posts_count INT DEFAULT 0 NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 0.00 NOT NULL,
    review_count INT DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL, -- 'active', 'suspended', 'deleted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pages_owner ON pages(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category_id);
CREATE INDEX IF NOT EXISTS idx_pages_status_visibility ON pages(status, visibility);

-- 14. Page Settings table
CREATE TABLE IF NOT EXISTS page_settings (
    page_id UUID PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
    allow_visitor_posts BOOLEAN DEFAULT TRUE NOT NULL,
    allow_tagging BOOLEAN DEFAULT TRUE NOT NULL,
    allow_mentions BOOLEAN DEFAULT TRUE NOT NULL,
    profanity_filter_level VARCHAR(20) DEFAULT 'medium' NOT NULL, -- 'none', 'medium', 'strong'
    age_restriction INT DEFAULT 0 NOT NULL,
    country_restrictions TEXT, -- JSON Array of countries
    auto_reply_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    auto_reply_message TEXT,
    auto_reply_keywords TEXT, -- JSON Array of keywords
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Page Members (Access Roster)
CREATE TABLE IF NOT EXISTS page_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(30) NOT NULL, -- 'owner', 'admin', 'editor', 'moderator', 'advertiser', 'analyst', 'viewer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_page_user_membership UNIQUE (page_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_page_members_user ON page_members(user_id);

-- 16. Page Followers table
CREATE TABLE IF NOT EXISTS page_followers (
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    is_liked BOOLEAN DEFAULT TRUE NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (page_id, user_id)
);

-- 17. Page Posts table
CREATE TABLE IF NOT EXISTS page_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
    author_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NULL,
    post_type VARCHAR(20) DEFAULT 'text' NOT NULL, -- 'text', 'image', 'video'
    status VARCHAR(20) DEFAULT 'published' NOT NULL, -- 'published', 'draft', 'scheduled'
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    is_featured BOOLEAN DEFAULT FALSE NOT NULL,
    is_boosted BOOLEAN DEFAULT FALSE NOT NULL,
    feeling VARCHAR(50) NULL,
    location_name VARCHAR(150) NULL,
    media_urls TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_page_posts_query ON page_posts(page_id, status, created_at DESC);

-- 18. Page Reviews table
CREATE TABLE IF NOT EXISTS page_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_page_user_review UNIQUE (page_id, user_id)
);

-- 19. Page Post Likes (Reactions) table
CREATE TABLE IF NOT EXISTS page_post_likes (
    post_id UUID REFERENCES page_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) DEFAULT 'like' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

-- 20. Page Post Comments table
CREATE TABLE IF NOT EXISTS page_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES page_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES page_post_comments(id) ON DELETE CASCADE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_page_post_comments_query ON page_post_comments(post_id, created_at ASC);

-- 21. Reels table
CREATE TABLE IF NOT EXISTS reels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    video_url VARCHAR(1024) NOT NULL,
    caption TEXT NULL,
    likes_count INT DEFAULT 0 NOT NULL,
    comments_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reels_user ON reels(user_id, created_at DESC);

-- 22. Reel Likes table
CREATE TABLE IF NOT EXISTS reel_likes (
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON reel_likes(reel_id);

-- 23. Reel Comments table
CREATE TABLE IF NOT EXISTS reel_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON reel_comments(reel_id, created_at ASC);

-- 24. Relational Profile Tables
-- Create User Profiles (One-to-One)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255) NULL,
    hometown VARCHAR(255) NULL,
    birthday VARCHAR(50) NULL,
    relationship_status VARCHAR(50) NULL,
    gender VARCHAR(20) NULL,
    pronouns VARCHAR(50) NULL,
    languages VARCHAR(255) NULL,
    category VARCHAR(100) NULL,
    pronunciation VARCHAR(255) NULL,
    other_names VARCHAR(255) NULL,
    copyright_statement TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Work (One-to-Many)
CREATE TABLE IF NOT EXISTS user_work (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL,
    description TEXT NULL,
    duration VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Education (One-to-Many)
CREATE TABLE IF NOT EXISTS user_education (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    school_name VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL, -- 'Đại học', 'Trường trung học phổ thông', 'Trường trung học'
    description TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Hobbies (One-to-Many)
CREATE TABLE IF NOT EXISTS user_hobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hobby_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Places Visited (One-to-Many)
CREATE TABLE IF NOT EXISTS user_places_visited (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    place_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Favorite Groups (One-to-Many)
CREATE TABLE IF NOT EXISTS user_favorite_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(255) NOT NULL,
    members_count VARCHAR(100) NULL,
    icon VARCHAR(20) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Social Links (One-to-Many)
CREATE TABLE IF NOT EXISTS user_social_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'instagram', 'website', 'blog', 'github', 'linkedin'
    url VARCHAR(1024) NOT NULL,
    privacy_level VARCHAR(20) DEFAULT 'public',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create User Offers (One-to-Many)
CREATE TABLE IF NOT EXISTS user_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    link VARCHAR(1024) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add privacy_settings column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}'::jsonb NOT NULL;

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Prepopulate locations
INSERT INTO locations (name) VALUES 
('Quận 1, Thành phố Hồ Chí Minh, Việt Nam'),
('Hà Nội, Việt Nam'),
('Đà Nẵng, Việt Nam'),
('Nha Trang, Việt Nam'),
('Đà Lạt, Việt Nam'),
('Cần Thơ, Việt Nam'),
('Hải Phòng, Việt Nam'),
('Vũng Tàu, Việt Nam'),
('Huế, Việt Nam'),
('Hạ Long, Việt Nam')
ON CONFLICT (name) DO NOTHING;

-- Create languages table
CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

INSERT INTO languages (name) VALUES 
('Tiếng Việt'), ('Tiếng Anh (English)'), ('Tiếng Trung (Chinese)'), ('Tiếng Tây Ban Nha (Spanish)'), 
('Tiếng Hindi'), ('Tiếng Ả Rập (Arabic)'), ('Tiếng Bengal (Bengali)'), ('Tiếng Bồ Đào Nha (Portuguese)'), 
('Tiếng Nga (Russian)'), ('Tiếng Urdu'), ('Tiếng Indonesia'), ('Tiếng Đức (German)'), 
('Tiếng Nhật (Japanese)'), ('Tiếng Pháp (French)'), ('Tiếng Thổ Nhĩ Kỳ (Turkish)'), ('Tiếng Ý (Italian)'), 
('Tiếng Hàn (Korean)'), ('Tiếng Thái (Thai)'), ('Tiếng Lào (Lao)'), ('Tiếng Campuchia (Khmer)'), 
('Tiếng Mã Lai (Malay)'), ('Tiếng Ba Lan (Polish)'), ('Tiếng Hà Lan (Dutch)'), ('Tiếng Thụy Điển (Swedish)'), 
('Tiếng Na Uy (Norwegian)'), ('Tiếng Đan Mạch (Danish)'), ('Tiếng Phần Lan (Finnish)'), ('Tiếng Hy Lạp (Greek)'), 
('Tiếng Rumani (Romanian)'), ('Tiếng Do Thái (Hebrew)'), ('Tiếng Hungary'), ('Tiếng Séc (Czech)'), 
('Tiếng Slovak'), ('Tiếng Bulgari'), ('Tiếng Ukraina (Ukrainian)'), ('Tiếng Miến Điện (Burmese)'), 
('Tiếng Mông Cổ'), ('Tiếng Ba Tư (Persian)'), ('Tiếng Latinh (Latin)'), ('Tiếng Phạn (Sanskrit)'), 
('Tiếng Esperanto'), ('Tiếng Swahili'), ('Tiếng Zulu'), ('Tiếng Amharic'), 
('Tiếng Yoruba'), ('Tiếng Igbo'), ('Tiếng Somali'), ('Tiếng Tagalog'), 
('Tiếng Tamil'), ('Tiếng Telugu'), ('Tiếng Marathi'), ('Tiếng Gujarati'), 
('Tiếng Kannada'), ('Tiếng Malayalam'), ('Tiếng Punjab (Punjabi)'), ('Tiếng Pashto'), 
('Tiếng Kurd'), ('Tiếng Armenia'), ('Tiếng Gruzia'), ('Tiếng Azerbaijan'), 
('Tiếng Kazakh'), ('Tiếng Uzbek'), ('Tiếng Kyrgyz'), ('Tiếng Tajik'), 
('Tiếng Turkmen'), ('Tiếng Nepal'), ('Tiếng Sinhala'), ('Tiếng Dhivehi'), 
('Tiếng Maori'), ('Tiếng Samoan'), ('Tiếng Tongan'), ('Tiếng Fiji'), 
('Tiếng Hawaii'), ('Tiếng Gaelic Scotland'), ('Tiếng Wales (Welsh)'), ('Tiếng Ireland (Irish)'), 
('Tiếng Basque'), ('Tiếng Catalan'), ('Tiếng Galicia'), ('Tiếng Yiddish'), 
('Tiếng Iceland'), ('Tiếng Malta'), ('Tiếng Albania'), ('Tiếng Macedonia'), 
('Tiếng Slovenia'), ('Tiếng Estonia'), ('Tiếng Latvia'), ('Tiếng Litva')
ON CONFLICT (name) DO NOTHING;

-- Create user_family table
CREATE TABLE IF NOT EXISTS user_family (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    member_type VARCHAR(20) NOT NULL, -- 'member' or 'pet'
    pet_name VARCHAR(255) NULL,
    relative_user_id UUID REFERENCES users(id) ON DELETE CASCADE NULL,
    relationship VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- 'pending', 'accepted'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);






