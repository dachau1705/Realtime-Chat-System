import { useState, useEffect } from 'react';
import { getData, postData } from '../../../lib/request';

// API Endpoints
export const checkBackendHealthApi = () => getData('/health');
export const loginApi = (username, password) => postData('/auth/login', { username, password });
export const registerApi = (username, email, password) => postData('/users', { username, email, password });
export const seedDatabaseApi = () => postData('/seed');

// Custom Hooks for GET APIs
export const useCheckBackendHealth = (params) => {
  const [data, setData] = useState(null);
  const paramsStr = JSON.stringify(params || {});
  useEffect(() => {
    async function fetchData() {
      const response = await checkBackendHealthApi(params);
      if (response.data && response.data.status !== false) {
        setData(response.data.data !== undefined ? response.data.data : response.data);
      }
    }
    fetchData();
  }, [paramsStr]);
  return data;
};
