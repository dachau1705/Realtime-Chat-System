import { useState, useEffect } from 'react';
import { getData, postData } from '../../../lib/request';

// API Endpoints
export const getStoriesApi = (params) => getData('/stories', params);
export const createStoryApi = (mediaUrl) => postData('/stories', { media_url: mediaUrl });

// Custom Hooks for GET APIs
export const useGetStories = (params) => {
  const [data, setData] = useState([]);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await getStoriesApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};
