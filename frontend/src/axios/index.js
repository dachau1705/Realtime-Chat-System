import axios from 'axios';
import { store } from '../redux/store';
import { setToast } from '../redux/slices/toastSlice';

// Resolve REACT_APP_API_URL from environments
const baseURL = (import.meta.env && import.meta.env.REACT_APP_API_URL) || 
                (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||
                '/api';

const axiosClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request Interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // Add Authorization header from sessionStorage or localStorage
    const token = sessionStorage.getItem('chatToken') || localStorage.getItem('chatToken') || localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
axiosClient.interceptors.response.use(
  (response) => {
    // Check if the successful response content itself indicates access denied
    if (response.data && response.data.mess === 'access denied') {
      store.dispatch(setToast('access denied'));
    }
    return response;
  },
  (error) => {
    let errorMsg = 'An unexpected error occurred';
    let isAccessDenied = false;

    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data;

      errorMsg = responseData?.error || responseData?.message || responseData?.mess || `HTTP Error ${status}`;
      
      if (status === 401 || status === 403 || errorMsg.toLowerCase().includes('access denied')) {
        isAccessDenied = true;
      }
    } else if (error.request) {
      errorMsg = 'Network connection issue, no response from server';
    } else {
      errorMsg = error.message;
    }

    if (isAccessDenied) {
      store.dispatch(setToast('access denied'));
    }

    // Normalize entire error response structure to avoid UI crashes
    return Promise.resolve({
      data: {
        data: {},
        status: false,
        mess: errorMsg
      }
    });
  }
);

export default axiosClient;
