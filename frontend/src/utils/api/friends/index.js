import { useState, useEffect } from 'react';
import { getData, postData } from '../../../lib/request';

// API Endpoints
export const getFriendRequestsApi = (params) => getData('/friends/requests', params);
export const getUserFriendsApi = (userId, params) => getData(`/users/${userId}/friends`, params);
export const addFriendByEmailApi = (email) => postData('/friends', { email });
export const acceptFriendRequestApi = (senderId) => postData('/friends/accept', { senderId });
export const declineFriendRequestApi = (senderId) => postData('/friends/decline', { senderId });
export const followUserApi = (userId) => postData(`/users/${userId}/follow`);
export const unfollowUserApi = (userId) => postData(`/users/${userId}/unfollow`);
export const getFollowStatusApi = (userId, params) => getData(`/users/${userId}/follow-status`, params);

// Custom Hooks for GET APIs
export const useGetFriendRequests = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getFriendRequestsApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};

export const useGetUserFriends = (userId, params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      const response = await getUserFriendsApi(userId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [userId, paramsStr]);
  return data;
};

export const useGetFollowStatus = (userId, params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    if (!userId) return;
    async function fetchData() {
      const response = await getFollowStatusApi(userId, params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [userId, paramsStr]);
  return data;
};
