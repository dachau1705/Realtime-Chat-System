import { dbPool } from '@libs/common';

export async function createUser(username: string, email: string, passwordHash: string) {
  const result = await dbPool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, created_at`,
    [username, email, passwordHash]
  );
  return result.rows[0];
}

export async function findUserByUsername(username: string) {
  const result = await dbPool.query(
    'SELECT id, username, email, full_name, avatar_url, password_hash FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const result = await dbPool.query(
    'SELECT id, username FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function searchUsers(q: string, currentUserId: string) {
  const result = await dbPool.query(
    `SELECT id, username, email, full_name, avatar_url 
     FROM users 
     WHERE (username ILIKE $1 OR email ILIKE $1 OR full_name ILIKE $1)
       AND id != $2
     LIMIT 10`,
    [`%${q}%`, currentUserId]
  );
  return result.rows;
}

export async function findUserById(id: string) {
  // 1. Fetch user base and profile fields
  const userResult = await dbPool.query(
    `SELECT u.id, u.username, u.email, u.created_at, u.full_name, u.avatar_url, u.cover_url, u.bio, u.privacy_is_public, u.phone,
            p.location, p.hometown, p.birthday, p.relationship_status, p.gender, p.pronouns, p.languages,
            p.category, p.pronunciation, p.other_names, p.copyright_statement, p.privacy_settings
     FROM users u
     LEFT JOIN user_profiles p ON u.id = p.user_id
     WHERE u.id = $1`,
    [id]
  );
  
  if (userResult.rows.length === 0) {
    return null;
  }
  
  const user = userResult.rows[0];
  
  // 2. Fetch work experiences
  const workResult = await dbPool.query(
    'SELECT id, company, position, description, duration FROM user_work WHERE user_id = $1',
    [id]
  );
  user.work = workResult.rows;

  // 3. Fetch education
  const eduResult = await dbPool.query(
    'SELECT id, school_name, degree, description FROM user_education WHERE user_id = $1',
    [id]
  );
  user.education = eduResult.rows;

  // 4. Fetch hobbies
  const hobbiesResult = await dbPool.query(
    'SELECT id, hobby_name FROM user_hobbies WHERE user_id = $1',
    [id]
  );
  user.hobbies = hobbiesResult.rows.map(r => r.hobby_name);

  // 5. Fetch places visited
  const placesResult = await dbPool.query(
    'SELECT id, place_name FROM user_places_visited WHERE user_id = $1',
    [id]
  );
  user.places_visited = placesResult.rows.map(r => r.place_name);

  // 6. Fetch favorite groups
  const groupsResult = await dbPool.query(
    'SELECT id, group_name, members_count, icon FROM user_favorite_groups WHERE user_id = $1',
    [id]
  );
  user.favorite_groups = groupsResult.rows;

  // 7. Fetch social links
  const linksResult = await dbPool.query(
    'SELECT id, platform, url, privacy_level FROM user_social_links WHERE user_id = $1',
    [id]
  );
  user.social_links = linksResult.rows;

  // 8. Fetch offers
  const offersResult = await dbPool.query(
    'SELECT id, title, description, link FROM user_offers WHERE user_id = $1',
    [id]
  );
  user.offers = offersResult.rows;

  // 9. Fetch family members
  const familyResult = await dbPool.query(
    `SELECT f.id, f.member_type, f.pet_name, f.relative_user_id, f.relationship, f.status, f.user_id as requester_id,
            u.username as relative_username, u.full_name as relative_full_name, u.avatar_url as relative_avatar_url,
            req.username as requester_username, req.full_name as requester_full_name, req.avatar_url as requester_avatar_url
     FROM user_family f
     LEFT JOIN users u ON f.relative_user_id = u.id
     LEFT JOIN users req ON f.user_id = req.id
     WHERE f.user_id = $1 OR f.relative_user_id = $1`,
    [id]
  );
  user.family_members = familyResult.rows;

  return user;
}

export async function updateUserProfile(
  id: string, 
  fullName: string, 
  phone: string, 
  bio: string, 
  privacyIsPublic: boolean,
  aboutData?: any
) {
  // Update base users table first
  const result = await dbPool.query(
    `UPDATE users 
     SET full_name = $1, phone = $2, bio = $3, privacy_is_public = $4
     WHERE id = $5
     RETURNING id, username, email, full_name, phone, bio, privacy_is_public`,
    [fullName, phone, bio, privacyIsPublic, id]
  );

  // If extra aboutData is provided, run a database transaction to update relational tables
  const newFamilyRequests: any[] = [];
  if (aboutData) {
    const client = await dbPool.connect();
    try {
      console.log("[DEBUG DATABASE] Starting upsert transaction for user_profiles. User ID:", id);
      await client.query('BEGIN');

      // 1. Upsert single-valued fields in user_profiles
      const personal = aboutData.personal_info || {};
      const upsertParams = [
        id,
        personal.location || null,
        personal.hometown || null,
        personal.birthday || null,
        personal.relationship_status || null,
        personal.gender || null,
        personal.pronouns || null,
        personal.languages || null,
        aboutData.category || null,
        aboutData.pronunciation || null,
        aboutData.other_names || null,
        aboutData.copyright_statement || null,
        JSON.stringify(aboutData.privacy_settings || {})
      ];
      console.log("[DEBUG DATABASE] Upserting user_profiles with parameters:", upsertParams);

      await client.query(
        `INSERT INTO user_profiles (
          user_id, location, hometown, birthday, relationship_status, 
          gender, pronouns, languages, category, pronunciation, 
          other_names, copyright_statement, privacy_settings
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
          location = EXCLUDED.location,
          hometown = EXCLUDED.hometown,
          birthday = EXCLUDED.birthday,
          relationship_status = EXCLUDED.relationship_status,
          gender = EXCLUDED.gender,
          pronouns = EXCLUDED.pronouns,
          languages = EXCLUDED.languages,
          category = EXCLUDED.category,
          pronunciation = EXCLUDED.pronunciation,
          other_names = EXCLUDED.other_names,
          copyright_statement = EXCLUDED.copyright_statement,
          privacy_settings = EXCLUDED.privacy_settings,
          updated_at = CURRENT_TIMESTAMP`,
        upsertParams
      );

      // 2. Sync work experiences
      if (aboutData.work && Array.isArray(aboutData.work)) {
        await client.query('DELETE FROM user_work WHERE user_id = $1', [id]);
        for (const w of aboutData.work) {
          if (w.company && w.position) {
            await client.query(
              'INSERT INTO user_work (user_id, company, position, description, duration) VALUES ($1, $2, $3, $4, $5)',
              [id, w.company, w.position, w.description || null, w.duration || null]
            );
          }
        }
      }

      // 3. Sync education
      if (aboutData.education && Array.isArray(aboutData.education)) {
        await client.query('DELETE FROM user_education WHERE user_id = $1', [id]);
        for (const e of aboutData.education) {
          if (e.school_name && e.degree) {
            await client.query(
              'INSERT INTO user_education (user_id, school_name, degree, description) VALUES ($1, $2, $3, $4)',
              [id, e.school_name, e.degree, e.description || null]
            );
          }
        }
      }

      // 4. Sync hobbies
      if (aboutData.hobbies && Array.isArray(aboutData.hobbies)) {
        await client.query('DELETE FROM user_hobbies WHERE user_id = $1', [id]);
        for (const h of aboutData.hobbies) {
          if (h && typeof h === 'string') {
            await client.query(
              'INSERT INTO user_hobbies (user_id, hobby_name) VALUES ($1, $2)',
              [id, h]
            );
          }
        }
      }

      // 5. Sync places visited
      if (aboutData.places_visited && Array.isArray(aboutData.places_visited)) {
        await client.query('DELETE FROM user_places_visited WHERE user_id = $1', [id]);
        for (const p of aboutData.places_visited) {
          if (p && typeof p === 'string') {
            await client.query(
              'INSERT INTO user_places_visited (user_id, place_name) VALUES ($1, $2)',
              [id, p]
            );
          }
        }
      }

      // 6. Sync favorite groups
      if (aboutData.favorite_groups && Array.isArray(aboutData.favorite_groups)) {
        await client.query('DELETE FROM user_favorite_groups WHERE user_id = $1', [id]);
        for (const g of aboutData.favorite_groups) {
          if (g.group_name) {
            await client.query(
              'INSERT INTO user_favorite_groups (user_id, group_name, members_count, icon) VALUES ($1, $2, $3, $4)',
              [id, g.group_name, g.members_count || null, g.icon || null]
            );
          }
        }
      }

      // 7. Sync social links
      if (aboutData.social_links && Array.isArray(aboutData.social_links)) {
        await client.query('DELETE FROM user_social_links WHERE user_id = $1', [id]);
        for (const l of aboutData.social_links) {
          if (l.platform && l.url) {
            await client.query(
              'INSERT INTO user_social_links (user_id, platform, url, privacy_level) VALUES ($1, $2, $3, $4)',
              [id, l.platform, l.url, l.privacy_level || 'public']
            );
          }
        }
      }

      // 8. Sync offers
      if (aboutData.offers && Array.isArray(aboutData.offers)) {
        await client.query('DELETE FROM user_offers WHERE user_id = $1', [id]);
        for (const o of aboutData.offers) {
          if (o.title) {
            await client.query(
              'INSERT INTO user_offers (user_id, title, description, link) VALUES ($1, $2, $3, $4)',
              [id, o.title, o.description || null, o.link || null]
            );
          }
        }
      }

      // 9. Ensure languages are registered in the languages table
      if (personal.languages) {
        const langList = personal.languages.split(',').map((l: string) => l.trim()).filter(Boolean);
        for (const lang of langList) {
          await client.query('INSERT INTO languages (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [lang]);
        }
      }

      // 10. Sync family members
      if (aboutData.family_members && Array.isArray(aboutData.family_members)) {
        // Find existing family relations to preserve their statuses (e.g. accepted status)
        const existingFamilyRes = await client.query(
          'SELECT relative_user_id, status FROM user_family WHERE user_id = $1 AND member_type = \'member\'',
          [id]
        );
        const existingMap = new Map(existingFamilyRes.rows.map(r => [r.relative_user_id, r.status]));

        await client.query('DELETE FROM user_family WHERE user_id = $1', [id]);
        for (const f of aboutData.family_members) {
          if (f.member_type === 'pet' && f.pet_name) {
            await client.query(
              'INSERT INTO user_family (user_id, member_type, pet_name, relationship, status) VALUES ($1, $2, $3, $4, $5)',
              [id, 'pet', f.pet_name, f.relationship || 'Thú cưng', 'accepted']
            );
          } else if (f.member_type === 'member' && f.relative_user_id) {
            const oldStatus = existingMap.get(f.relative_user_id);
            const status = oldStatus || 'pending';
            const famInsertRes = await client.query(
              'INSERT INTO user_family (user_id, member_type, relative_user_id, relationship, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
              [id, 'member', f.relative_user_id, f.relationship || 'Thành viên gia đình', status]
            );
            
            if (!oldStatus) {
              // Newly added relative request!
              newFamilyRequests.push({
                requestId: famInsertRes.rows[0].id,
                relative_user_id: f.relative_user_id,
                relationship: f.relationship
              });
            }
          }
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      console.error('DB TRANSACTION ERROR IN UPDATE USER PROFILE:', txErr);
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  }

  return { user: result.rows[0], newFamilyRequests };
}

export async function updateUserAvatar(id: string, avatarUrl: string) {
  const result = await dbPool.query(
    'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, username, avatar_url',
    [avatarUrl, id]
  );
  return result.rows[0];
}

export async function updateUserCover(id: string, coverUrl: string) {
  const result = await dbPool.query(
    'UPDATE users SET cover_url = $1 WHERE id = $2 RETURNING id, username, cover_url',
    [coverUrl, id]
  );
  return result.rows[0];
}

export async function getFollowRelation(followerId: string, followingId: string) {
  const result = await dbPool.query(
    'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );
  return result.rows.length > 0;
}

export async function createFollowRelation(followerId: string, followingId: string) {
  await dbPool.query(
    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
    [followerId, followingId]
  );
}

export async function deleteFollowRelation(followerId: string, followingId: string) {
  await dbPool.query(
    'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );
}

export async function searchLocations(q: string) {
  const result = await dbPool.query(
    'SELECT id, name FROM locations WHERE name ILIKE $1 ORDER BY name ASC LIMIT 10',
    [`%${q}%`]
  );
  return result.rows;
}

export async function searchLanguages(q: string) {
  const result = await dbPool.query(
    'SELECT id, name FROM languages WHERE name ILIKE $1 ORDER BY name ASC LIMIT 10',
    [`%${q}%`]
  );
  return result.rows;
}

export async function acceptFamilyRequest(userId: string, requestId: string) {
  const result = await dbPool.query(
    `UPDATE user_family
     SET status = 'accepted'
     WHERE id = $1 AND relative_user_id = $2
     RETURNING user_id, relationship`,
    [requestId, userId]
  );
  if (result.rows.length === 0) return null;
  
  const { user_id: initiatorId, relationship } = result.rows[0];

  // Reciprocal relationship calculation
  let reciprocalRelation = 'Thành viên gia đình';
  if (relationship === 'Vợ') reciprocalRelation = 'Chồng';
  else if (relationship === 'Chồng') reciprocalRelation = 'Vợ';
  else if (relationship === 'Bố' || relationship === 'Mẹ') reciprocalRelation = 'Con';
  else if (relationship === 'Con') reciprocalRelation = 'Bố/Mẹ';
  else if (relationship === 'Anh/chị/em') reciprocalRelation = 'Anh/chị/em';

  await dbPool.query(
    `INSERT INTO user_family (user_id, member_type, relative_user_id, relationship, status)
     VALUES ($1, 'member', $2, $3, 'accepted')
     ON CONFLICT DO NOTHING`,
    [userId, initiatorId, reciprocalRelation]
  );

  return { initiatorId, relationship };
}

