import { useState, useEffect } from 'react';
import { getData, postData, putData, deleteData } from '../../../lib/request';

// API Endpoints
export const getFeedApi = (params) => getData('/feed', params);
export const createPostApi = (content, mediaUrls, visibility = 'public', allowedUserIds = [], blockedUserIds = []) => 
  postData('/posts', { content, media_urls: mediaUrls, visibility, allowed_user_ids: allowedUserIds, blocked_user_ids: blockedUserIds });
export const getPostDetailsApi = (postId, params) => getData(`/posts/${postId}`, params);
export const updatePostApi = (postId, content, mediaUrls) => putData(`/posts/${postId}`, { content, media_urls: mediaUrls });
export const deletePostApi = (postId) => deleteData(`/posts/${postId}`);
export const getUserPostsApi = (userId, params) => getData(`/users/${userId}/posts`, params);
export const reactToPostApi = (postId, type) => postData(`/posts/${postId}/react`, { type });
export const commentOnPostApi = (postId, content, parentId) => postData(`/posts/${postId}/comments`, { content, parent_id: parentId });
export const getPostCommentsApi = (postId, params) => getData(`/posts/${postId}/comments`, params);

// Custom Hooks for GET APIs
export const useGetFeed = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getFeedApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};

export const useGetPostDetails = (postId, params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!postId) return;
    async function fetchData() {
      const response = await getPostDetailsApi(postId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [postId, paramsStr]);
  return data;
};

export const useGetUserPosts = (userId, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      const response = await getUserPostsApi(userId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [userId, paramsStr]);
  return data;
};

export const useGetPostComments = (postId, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!postId) return;
    async function fetchData() {
      const response = await getPostCommentsApi(postId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [postId, paramsStr]);
  return data;
};
