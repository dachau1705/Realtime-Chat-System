import { useState, useEffect } from 'react';
import { getData, postData, putData } from '../../../lib/request';

// API Endpoints
export const getUsersApi = (params) => getData('/users', params);
export const getUserProfileApi = (userId, params) => getData(`/users/${userId}`, params);
export const getSuggestionsApi = (params) => getData('/users/suggestions', params);
export const searchUsersApi = (query, params) => getData('/search/users', { q: query, ...params });
export const updateUserProfileApi = (userId, data) => putData(`/users/${userId}`, data);
export const uploadAvatarApi = (file) => postData('/upload/avatar', { file }, { isFormData: true });
export const uploadCoverApi = (file) => postData('/upload/cover', { file }, { isFormData: true });

// Custom Hooks for GET APIs
export const useGetUsers = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getUsersApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};

export const useGetUserProfile = (userId, params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      const response = await getUserProfileApi(userId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [userId, paramsStr]);
  return data;
};

export const useGetSuggestions = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getSuggestionsApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};

export const useSearchUsers = (query, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!query || !query.trim()) {
      setData([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      const response = await searchUsersApi(query.trim(), params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }, 350);
    return () => clearTimeout(delayDebounce);
  }, [query, paramsStr]);
  return data;
};
