import { useState, useEffect } from 'react';
import { getData, postData, putData, deleteData } from '../../../lib/request';

// API Endpoints
export const getPageCategoriesApi = (params) => getData('/page-categories', params);
export const createPageApi = (payload) => postData('/pages', payload);
export const getPageDetailApi = (id, params) => getData(`/pages/detail/${id}`, params);
export const getPagePostsApi = (id, params) => getData(`/pages/${id}/posts`, params);
export const getPageMembersApi = (id, params) => getData(`/pages/${id}/members`, params);
export const getPageReviewsApi = (id, params) => getData(`/pages/${id}/reviews`, params);
export const getPageSettingsApi = (id, params) => getData(`/pages/${id}/settings`, params);
export const getPageInsightsApi = (id, params) => getData(`/pages/${id}/insights`, params);
export const getMyPagesApi = (params) => getData('/pages/my', params);
export const updatePageSettingsApi = (id, data) => putData(`/pages/${id}/settings`, data);
export const managePageMembersApi = (id, data) => postData(`/pages/${id}/members`, data);
export const deletePageMemberApi = (id, userId) => deleteData(`/pages/${id}/members/${userId}`);
export const followPageApi = (id) => postData(`/pages/${id}/follow`);
export const unfollowPageApi = (id) => postData(`/pages/${id}/unfollow`);
export const createPagePostApi = (id, data) => postData(`/pages/${id}/posts`, data);
export const createPageReviewApi = (id, data) => postData(`/pages/${id}/reviews`, data);

// Custom Hooks for GET APIs
export const useGetPageCategories = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!enabled) return;
    async function fetchData() {
      const response = await getPageCategoriesApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr, enabled]);
  return data;
};

export const useGetPageDetail = (id, params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!id || !enabled) return;
    async function fetchData() {
      const response = await getPageDetailApi(id, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [id, paramsStr, enabled]);
  return data;
};

export const useGetPagePosts = (id, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!id || !enabled) return;
    async function fetchData() {
      const response = await getPagePostsApi(id, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [id, paramsStr, enabled]);
  return data;
};

export const useGetPageMembers = (id, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!id || !enabled) return;
    async function fetchData() {
      const response = await getPageMembersApi(id, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [id, paramsStr, enabled]);
  return data;
};

export const useGetPageReviews = (id, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!id || !enabled) return;
    async function fetchData() {
      const response = await getPageReviewsApi(id, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [id, paramsStr, enabled]);
  return data;
};

export const useGetPageSettings = (id, params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!id || !enabled) return;
    async function fetchData() {
      const response = await getPageSettingsApi(id, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [id, paramsStr, enabled]);
  return data;
};

export const useGetPageInsights = (id, params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!id || !enabled) return;
    async function fetchData() {
      const response = await getPageInsightsApi(id, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [id, paramsStr, enabled]);
  return data;
};

export const useGetMyPages = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  const enabled = params?.enabled !== false;
  useEffect(() => {
    if (!enabled) return;
    async function fetchData() {
      const response = await getMyPagesApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr, enabled]);
  return data;
};
