/**
 * Recursively trims string values in an object or array.
 */
export function recursiveTrim(val) {
  if (typeof val === 'string') {
    return val.trim();
  }
  if (val && typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(recursiveTrim);
    }
    if (val instanceof File || val instanceof Blob || val instanceof Date) {
      return val;
    }
    const res = {};
    for (const k in val) {
      if (Object.prototype.hasOwnProperty.call(val, k)) {
        res[k] = recursiveTrim(val[k]);
      }
    }
    return res;
  }
  return val;
}

/**
 * Stringifies nested objects/arrays and trims all strings in an object.
 */
export function convertData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const result = Array.isArray(data) ? [] : {};
  
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      if (typeof val === 'string') {
        result[key] = val.trim();
      } else if (val && typeof val === 'object') {
        if (val instanceof File || val instanceof Blob || val instanceof Date) {
          result[key] = val;
        } else {
          const trimmedVal = recursiveTrim(val);
          result[key] = JSON.stringify(trimmedVal);
        }
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Converts a flat/nested object into FormData for file/multipart uploads.
 */
export function createFormData(data) {
  const formData = new FormData();
  if (!data || typeof data !== 'object') return formData;

  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      if (val instanceof File || val instanceof Blob) {
        formData.append(key, val);
      } else if (val && typeof val === 'object') {
        if (val instanceof Date) {
          formData.append(key, val.toISOString());
        } else {
          formData.append(key, JSON.stringify(recursiveTrim(val)));
        }
      } else if (val !== undefined && val !== null) {
        formData.append(key, typeof val === 'string' ? val.trim() : val);
      }
    }
  }
  return formData;
}
