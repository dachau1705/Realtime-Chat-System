import { useState, useEffect } from 'react';
import { getData, postData } from '../../../lib/request';

// API Endpoints
export const getNotificationsApi = (params) => getData('/notifications', params);
export const markNotificationsAsReadApi = (notificationId) => postData('/notifications/read', { notificationId });

// Custom Hooks for GET APIs
export const useGetNotifications = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getNotificationsApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};
