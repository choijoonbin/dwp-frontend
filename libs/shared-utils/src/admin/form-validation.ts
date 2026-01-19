// ----------------------------------------------------------------------

/**
 * Form validation utilities for Admin CRUD forms
 */

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Get email validation error message
 */
export const getEmailError = (email: string): string | undefined => {
  if (!email) return undefined;
  if (!validateEmail(email)) {
    return '올바른 이메일 형식이 아닙니다.';
  }
  return undefined;
};

/**
 * Validate password strength
 * - Minimum 8 characters
 * - At least one letter and one number
 */
export const validatePassword = (password: string): boolean => {
  if (!password) return false;
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
};

/**
 * Get password validation error message
 */
export const getPasswordError = (password: string): string | undefined => {
  if (!password) return '비밀번호를 입력해주세요.';
  if (password.length < 8) {
    return '비밀번호는 최소 8자 이상이어야 합니다.';
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber) {
    return '비밀번호는 영문과 숫자를 포함해야 합니다.';
  }
  return undefined;
};

/**
 * Validate required field
 */
export const validateRequired = (value: string | null | undefined): boolean =>
  Boolean(value && value.trim().length > 0);

/**
 * Get required field error message
 */
export const getRequiredError = (fieldName: string, value: string | null | undefined): string | undefined => {
  if (!validateRequired(value)) {
    return `${fieldName}을(를) 입력해주세요.`;
  }
  return undefined;
};

/**
 * Validate resource key format (alphanumeric, underscore, dot)
 */
export const validateResourceKey = (key: string): boolean => {
  if (!key) return false;
  const keyRegex = /^[a-zA-Z0-9._-]+$/;
  return keyRegex.test(key);
};

/**
 * Get resource key validation error message
 */
export const getResourceKeyError = (key: string): string | undefined => {
  if (!key) return '리소스 키를 입력해주세요.';
  if (!validateResourceKey(key)) {
    return '리소스 키는 영문, 숫자, 언더스코어(_), 점(.), 하이픈(-)만 사용할 수 있습니다.';
  }
  return undefined;
};

/**
 * Validate code key format (alphanumeric, underscore)
 */
export const validateCodeKey = (key: string): boolean => {
  if (!key) return false;
  const keyRegex = /^[a-zA-Z0-9_]+$/;
  return keyRegex.test(key);
};

/**
 * Get code key validation error message
 */
export const getCodeKeyError = (key: string): string | undefined => {
  if (!key) return '코드 키를 입력해주세요.';
  if (!validateCodeKey(key)) {
    return '코드 키는 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다.';
  }
  return undefined;
};
