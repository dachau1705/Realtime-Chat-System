import { dbPool } from '@libs/common';

export async function getPageCategories() {
  const result = await dbPool.query('SELECT * FROM page_categories ORDER BY name ASC');
  return result.rows;
}

export async function checkDuplicatePage(username: string, slug: string) {
  const result = await dbPool.query(
    'SELECT id FROM pages WHERE username = $1 OR slug = $2',
    [username, slug]
  );
  return result.rows.length > 0;
}

export async function createPageTransaction(
  ownerId: string,
  pageData: {
    pageName: string;
    username: string;
    slug: string;
    categoryId: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    avatar: string | null;
    coverPhoto: string | null;
  }
) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const pageRes = await client.query(
      `INSERT INTO pages (owner_user_id, page_name, username, slug, category_id, description, phone, email, website, location, latitude, longitude, avatar, cover_photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        ownerId,
        pageData.pageName,
        pageData.username,
        pageData.slug,
        pageData.categoryId,
        pageData.description,
        pageData.phone,
        pageData.email,
        pageData.website,
        pageData.location,
        pageData.latitude,
        pageData.longitude,
        pageData.avatar,
        pageData.coverPhoto
      ]
    );
    const page = pageRes.rows[0];

    // Insert default settings
    await client.query('INSERT INTO page_settings (page_id) VALUES ($1)', [page.id]);

    // Insert owner role
    await client.query(
      `INSERT INTO page_members (page_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [page.id, ownerId]
    );

    await client.query('COMMIT');
    return page;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getMyPages(userId: string) {
  const result = await dbPool.query(
    `SELECT p.*, pm.role 
     FROM pages p
     JOIN page_members pm ON p.id = pm.page_id
     WHERE pm.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function findPageById(pageId: string) {
  const result = await dbPool.query(
    `SELECT p.*, pc.name as category_name
     FROM pages p
     JOIN page_categories pc ON p.category_id = pc.id
     WHERE p.id = $1`,
    [pageId]
  );
  return result.rows[0] || null;
}

export async function getPageMemberRole(pageId: string, userId: string) {
  const result = await dbPool.query(
    'SELECT role FROM page_members WHERE page_id = $1 AND user_id = $2',
    [pageId, userId]
  );
  return result.rows[0]?.role || null;
}

export async function checkPageFollower(pageId: string, userId: string) {
  const result = await dbPool.query(
    'SELECT 1 FROM page_followers WHERE page_id = $1 AND user_id = $2',
    [pageId, userId]
  );
  return result.rows.length > 0;
}

export async function getPageSettings(pageId: string) {
  const result = await dbPool.query('SELECT * FROM page_settings WHERE page_id = $1', [pageId]);
  return result.rows[0] || null;
}

export async function upsertPageSettings(
  pageId: string,
  settings: {
    allowVisitorPosts: boolean;
    allowTagging: boolean;
    allowMentions: boolean;
    profanityFilterLevel: string;
    ageRestriction: number;
    countryRestrictions: string;
    autoReplyEnabled: boolean;
    autoReplyMessage: string | null;
    autoReplyKeywords: string;
  }
) {
  await dbPool.query(
    `UPDATE page_settings 
     SET allow_visitor_posts = $1, allow_tagging = $2, allow_mentions = $3, profanity_filter_level = $4, 
         age_restriction = $5, country_restrictions = $6, auto_reply_enabled = $7, auto_reply_message = $8, 
         auto_reply_keywords = $9, updated_at = NOW()
     WHERE page_id = $10`,
    [
      settings.allowVisitorPosts,
      settings.allowTagging,
      settings.allowMentions,
      settings.profanityFilterLevel,
      settings.ageRestriction,
      settings.countryRestrictions,
      settings.autoReplyEnabled,
      settings.autoReplyMessage,
      settings.autoReplyKeywords,
      pageId
    ]
  );
}

export async function getPageMembers(pageId: string) {
  const result = await dbPool.query(
    `SELECT pm.user_id, pm.role, pm.created_at, u.username, u.email, u.full_name, u.avatar_url
     FROM page_members pm
     JOIN users u ON pm.user_id = u.id
     WHERE pm.page_id = $1
     ORDER BY pm.created_at ASC`,
    [pageId]
  );
  return result.rows;
}

export async function upsertPageMember(pageId: string, userId: string, role: string) {
  await dbPool.query(
    `INSERT INTO page_members (page_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (page_id, user_id) 
     DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
    [pageId, userId, role]
  );
}

export async function deletePageMember(pageId: string, userId: string) {
  const result = await dbPool.query(
    'DELETE FROM page_members WHERE page_id = $1 AND user_id = $2',
    [pageId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function followPageTransaction(pageId: string, userId: string) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO page_followers (page_id, user_id) 
       VALUES ($1, $2)
       ON CONFLICT (page_id, user_id) DO NOTHING
       RETURNING *`,
      [pageId, userId]
    );
    if (result.rows.length > 0) {
      await client.query(
        'UPDATE pages SET followers_count = followers_count + 1, likes_count = likes_count + 1 WHERE id = $1',
        [pageId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function unfollowPageTransaction(pageId: string, userId: string) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM page_followers WHERE page_id = $1 AND user_id = $2 RETURNING *',
      [pageId, userId]
    );
    if (result.rows.length > 0) {
      await client.query(
        'UPDATE pages SET followers_count = GREATEST(0, followers_count - 1), likes_count = GREATEST(0, likes_count - 1) WHERE id = $1',
        [pageId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createPagePost(
  pageId: string,
  authorId: string,
  content: string | null,
  postType: string,
  mediaUrls: string[]
) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO page_posts (page_id, author_user_id, content, post_type, media_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [pageId, authorId, content, postType, mediaUrls]
    );
    const post = result.rows[0];

    await client.query('UPDATE pages SET posts_count = posts_count + 1 WHERE id = $1', [pageId]);

    await client.query('COMMIT');
    return post;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPagePosts(pageId: string, limit: number, offset: number) {
  const result = await dbPool.query(
    `SELECT pp.*, u.username as author_username, u.avatar_url as author_avatar
     FROM page_posts pp
     JOIN users u ON pp.author_user_id = u.id
     WHERE pp.page_id = $1 AND pp.status = 'published'
     ORDER BY pp.created_at DESC
     LIMIT $2 OFFSET $3`,
    [pageId, limit, offset]
  );
  return result.rows;
}

export async function createPageReviewTransaction(
  pageId: string,
  userId: string,
  rating: number,
  reviewText: string | null
) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO page_reviews (page_id, user_id, rating, review_text) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (page_id, user_id) 
       DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text, updated_at = NOW()`,
      [pageId, userId, rating, reviewText]
    );

    const ratingRes = await client.query(
      `SELECT AVG(rating)::DECIMAL(3,2) as avg_rating, COUNT(id) as count_rating 
       FROM page_reviews WHERE page_id = $1`,
      [pageId]
    );
    const stats = ratingRes.rows[0];

    await client.query(
      'UPDATE pages SET rating = $1, review_count = $2 WHERE id = $3',
      [stats.avg_rating || 0.00, stats.count_rating || 0, pageId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPageReviews(pageId: string) {
  const result = await dbPool.query(
    `SELECT pr.*, u.username, u.full_name, u.avatar_url
     FROM page_reviews pr
     JOIN users u ON pr.user_id = u.id
     WHERE pr.page_id = $1
     ORDER BY pr.created_at DESC`,
    [pageId]
  );
  return result.rows;
}
