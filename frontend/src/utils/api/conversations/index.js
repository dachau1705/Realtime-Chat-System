import { useState, useEffect } from 'react';
import { getData, postData } from '../../../lib/request';

// API Endpoints
export const getConversationsApi = (params) => getData('/conversations', params);
export const getChatHistoryApi = (roomId, params) => getData(`/conversations/${roomId}/messages`, params);
export const createConversationApi = (otherUserId) => postData('/conversations', { name: null, isGroup: false, memberIds: [otherUserId] });
export const createGroupConversationApi = (name, memberIds, avatarUrl) => postData('/conversations', { name, isGroup: true, memberIds, avatarUrl });
export const markConversationAsReadApi = (roomId) => postData(`/conversations/${roomId}/read`);

// Custom Hooks for GET APIs
export const useGetConversations = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getConversationsApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};

export const useGetChatHistory = (roomId, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!roomId) return;
    async function fetchData() {
      const response = await getChatHistoryApi(roomId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [roomId, paramsStr]);
  return data;
};
