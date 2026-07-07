import { getData, postData } from '../../../lib/request';

/**
 * Fetch a list of companies.
 */
export function getCompanies(params) {
  return getData('/companies/company', params);
}

/**
 * Fetch details of a single company.
 */
export function getCompanyById(id) {
  return getData(`/companies/company/${id}`);
}

/**
 * Create a new company record.
 */
export function createCompany(data) {
  return postData('/companies/company', data);
}

/**
 * Update an existing company record.
 */
export function updateCompany(id, data) {
  return postData(`/companies/company/${id}`, data);
}

/**
 * Upload a document for a company using FormData.
 */
export function uploadCompanyDocument(id, fileData) {
  return postData(`/companies/company/${id}/document`, fileData, { isFormData: true });
}
