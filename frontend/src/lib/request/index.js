import axiosClient from '../../axios';
import { convertData, createFormData } from './request';

/**
 * Perform a GET request using Axios, transforming the query parameters.
 */
export async function getData(url, params = {}) {
  const cleanParams = convertData(params);
  return axiosClient.get(url, { params: cleanParams });
}

/**
 * Perform a POST request using Axios.
 */
export async function postData(url, data = {}, options = {}) {
  let payload;
  const config = { ...options };

  if (options.isFormData) {
    payload = createFormData(data);
    config.headers = {
      ...config.headers,
      'Content-Type': 'multipart/form-data'
    };
    delete config.isFormData;
  } else {
    payload = convertData(data);
  }

  return axiosClient.post(url, payload, config);
}

/**
 * Perform a PUT request using Axios.
 */
export async function putData(url, data = {}, options = {}) {
  let payload;
  const config = { ...options };

  if (options.isFormData) {
    payload = createFormData(data);
    config.headers = {
      ...config.headers,
      'Content-Type': 'multipart/form-data'
    };
    delete config.isFormData;
  } else {
    payload = convertData(data);
  }

  return axiosClient.put(url, payload, config);
}

/**
 * Perform a DELETE request using Axios.
 */
export async function deleteData(url, options = {}) {
  return axiosClient.delete(url, options);
}
