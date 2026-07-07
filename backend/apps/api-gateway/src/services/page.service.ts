import * as pageRepo from '../repositories/page.repository';
import * as userRepo from '../repositories/user.repository';
import { createNotification } from '../helpers/notification.helper';

const RESERVED_USERNAMES = ['admin', 'official', 'support', 'settings', 'help', 'feed', 'system', 'developer', 'hoda', 'page', 'group', 'user'];
const PROFANITY_WORDS = ['abuse', 'badword', 'offensive', 'spam', 'scam'];

export async function getCategories() {
  return await pageRepo.getPageCategories();
}

export async function createPage(
  ownerId: string,
  pageData: {
    pageName: string;
    username: string;
    categoryId: string;
    description: string;
    phone: string;
    email: string;
    website: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    avatar: string;
    coverPhoto: string;
  }
) {
  const { pageName, username, categoryId } = pageData;

  if (!pageName || pageName.trim().length < 3) {
    throw new Error('Page name must be at least 3 characters.');
  }
  if (!username || username.trim().length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  if (!categoryId) {
    throw new Error('Category is required.');
  }

  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '.');
  const slug = pageName.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

  if (RESERVED_USERNAMES.includes(cleanUsername)) {
    throw new Error(`Username "${cleanUsername}" is a reserved system keyword.`);
  }
  if (PROFANITY_WORDS.some(word => pageName.toLowerCase().includes(word))) {
    throw new Error('Page name contains disallowed or offensive terms.');
  }

  const isDuplicate = await pageRepo.checkDuplicatePage(cleanUsername, slug);
  if (isDuplicate) {
    throw new Error('Username or Page slug is already taken.');
  }

  return await pageRepo.createPageTransaction(ownerId, {
    pageName,
    username: cleanUsername,
    slug,
    categoryId,
    description: pageData.description || null,
    phone: pageData.phone || null,
    email: pageData.email || null,
    website: pageData.website || null,
    location: pageData.location || null,
    latitude: pageData.latitude,
    longitude: pageData.longitude,
    avatar: pageData.avatar || null,
    coverPhoto: pageData.coverPhoto || null
  });
}

export async function getPagesForUser(userId: string) {
  return await pageRepo.getMyPages(userId);
}

export async function getPageDetail(pageId: string, userId: string) {
  const page = await pageRepo.findPageById(pageId);
  if (!page) {
    throw new Error('Page not found.');
  }

  const userRole = await pageRepo.getPageMemberRole(pageId, userId);
  const isFollowing = await pageRepo.checkPageFollower(pageId, userId);

  return {
    ...page,
    userRole,
    isFollowing
  };
}

export async function getSettings(pageId: string, userId: string) {
  const role = await pageRepo.getPageMemberRole(pageId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Access denied. Settings require Owner or Admin permissions.');
  }

  return await pageRepo.getPageSettings(pageId);
}

export async function updateSettings(
  pageId: string,
  userId: string,
  settings: {
    allowVisitorPosts: boolean;
    allowTagging: boolean;
    allowMentions: boolean;
    profanityFilterLevel: string;
    ageRestriction: number;
    countryRestrictions: any[];
    autoReplyEnabled: boolean;
    autoReplyMessage: string | null;
    autoReplyKeywords: any[];
  }
) {
  const role = await pageRepo.getPageMemberRole(pageId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Access denied. Settings require Owner or Admin permissions.');
  }

  await pageRepo.upsertPageSettings(pageId, {
    allowVisitorPosts: settings.allowVisitorPosts !== false,
    allowTagging: settings.allowTagging !== false,
    allowMentions: settings.allowMentions !== false,
    profanityFilterLevel: settings.profanityFilterLevel || 'medium',
    ageRestriction: settings.ageRestriction || 0,
    countryRestrictions: JSON.stringify(settings.countryRestrictions || []),
    autoReplyEnabled: settings.autoReplyEnabled === true,
    autoReplyMessage: settings.autoReplyMessage,
    autoReplyKeywords: JSON.stringify(settings.autoReplyKeywords || [])
  });

  return { message: 'Settings updated successfully.' };
}

export async function getMembers(pageId: string, userId: string) {
  const role = await pageRepo.getPageMemberRole(pageId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Access denied. Listing members requires Owner or Admin permissions.');
  }

  return await pageRepo.getPageMembers(pageId);
}

export async function assignMember(
  pageId: string,
  userId: string,
  targetEmail: string,
  role: string
) {
  const currentRole = await pageRepo.getPageMemberRole(pageId, userId);
  if (currentRole !== 'owner' && currentRole !== 'admin') {
    throw new Error('Access denied. Roles require Owner or Admin permissions.');
  }

  const targetUser = await userRepo.findUserByEmail(targetEmail.trim().toLowerCase());
  if (!targetUser) {
    throw new Error('User with this email not found.');
  }

  await pageRepo.upsertPageMember(pageId, targetUser.id, role);
  return { message: `Successfully assigned ${targetUser.username} to role ${role}.` };
}

export async function removeMember(pageId: string, currentUserId: string, targetUserId: string) {
  const role = await pageRepo.getPageMemberRole(pageId, currentUserId);
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Access denied. Removing members requires Owner or Admin permissions.');
  }

  const targetRole = await pageRepo.getPageMemberRole(pageId, targetUserId);
  if (targetRole === 'owner') {
    throw new Error('Cannot remove the owner of the page.');
  }

  const success = await pageRepo.deletePageMember(pageId, targetUserId);
  if (!success) {
    throw new Error('Member not found.');
  }

  return { message: 'Member removed successfully.' };
}

export async function followPage(pageId: string, userId: string) {
  const page = await pageRepo.findPageById(pageId);
  if (!page) {
    throw new Error('Page not found.');
  }

  await pageRepo.followPageTransaction(pageId, userId);

  // Send alert
  if (page.owner_user_id && page.owner_user_id !== userId) {
    await createNotification(page.owner_user_id, userId, 'follow', null, null);
  }

  return { message: 'Page followed successfully.' };
}

export async function unfollowPage(pageId: string, userId: string) {
  const page = await pageRepo.findPageById(pageId);
  if (!page) {
    throw new Error('Page not found.');
  }

  await pageRepo.unfollowPageTransaction(pageId, userId);
  return { message: 'Page unfollowed successfully.' };
}

export async function createPost(
  pageId: string,
  userId: string,
  content: string | null,
  postType: string | null,
  mediaUrls: string[]
) {
  const role = await pageRepo.getPageMemberRole(pageId, userId);
  const isAuthorized = role === 'owner' || role === 'admin' || role === 'editor';
  if (!isAuthorized) {
    throw new Error('Access denied. You do not have permissions to post on this page.');
  }

  return await pageRepo.createPagePost(pageId, userId, content, postType || 'text', mediaUrls);
}

export async function getPosts(pageId: string, limit: number, offset: number) {
  return await pageRepo.getPagePosts(pageId, limit, offset);
}

export async function createReview(pageId: string, userId: string, rating: number, reviewText: string | null) {
  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Rating value must be between 1 and 5 stars.');
  }

  await pageRepo.createPageReviewTransaction(pageId, userId, rating, reviewText);
  return { message: 'Review submitted successfully.' };
}

export async function getReviews(pageId: string) {
  return await pageRepo.getPageReviews(pageId);
}

export async function getInsights(pageId: string, userId: string) {
  const isMember = await pageRepo.getPageMemberRole(pageId, userId);
  const allowedRoles = ['owner', 'admin', 'editor', 'moderator', 'advertiser', 'analyst'];
  if (!isMember || !allowedRoles.includes(isMember)) {
    throw new Error('Access denied. Only page administrators can view insights.');
  }

  const page = await pageRepo.findPageById(pageId);
  if (!page) {
    throw new Error('Page not found.');
  }

  return {
    reach: 12450 + (page.followers_count || 0) * 12,
    followers: page.followers_count || 0,
    likes: page.likes_count || 0,
    posts: page.posts_count || 0,
    rating: page.rating || '0.00',
    reviews: page.review_count || 0,
    demographics: [
      { segment: 'Women (18-24)', percent: 25 },
      { segment: 'Men (18-24)', percent: 35 },
      { segment: 'Women (25-34)', percent: 20 },
      { segment: 'Men (25-34)', percent: 20 }
    ],
    reachData: [
      { date: 'Jul 01', value: 12400 },
      { date: 'Jul 02', value: 14500 },
      { date: 'Jul 03', value: 13900 },
      { date: 'Jul 04', value: 18400 },
      { date: 'Jul 05', value: 22100 },
      { date: 'Jul 06', value: 20500 }
    ]
  };
}
