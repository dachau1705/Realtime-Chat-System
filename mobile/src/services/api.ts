import axios from 'axios';
import { API_URL } from './config';
import { getToken } from './storage';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getData = (url: string, params?: any) => api.get(url, { params });
export const postData = (url: string, data?: any) => api.post(url, data);
export const putData = (url: string, data?: any) => api.put(url, data);
export const deleteData = (url: string, params?: any) => api.delete(url, { params });

export default api;
