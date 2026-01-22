import { it, expect, describe } from 'vitest';

import { HttpError } from '../../http-error';
import { classifyApiError, isRetryableError, getApiErrorMessage, getApiErrorDisplayProps } from '../api-error-handler';

// ----------------------------------------------------------------------

describe('api-error-handler', () => {
  describe('classifyApiError', () => {
    it('should classify 401 as UNAUTHORIZED', () => {
      const error = new HttpError('Unauthorized', 401);
      expect(classifyApiError(error)).toBe('UNAUTHORIZED');
    });

    it('should classify 403 as FORBIDDEN', () => {
      const error = new HttpError('Forbidden', 403);
      expect(classifyApiError(error)).toBe('FORBIDDEN');
    });

    it('should classify 500 as SERVER_ERROR', () => {
      const error = new HttpError('Internal Server Error', 500);
      expect(classifyApiError(error)).toBe('SERVER_ERROR');
    });

    it('should classify 502 as SERVER_ERROR', () => {
      const error = new HttpError('Bad Gateway', 502);
      expect(classifyApiError(error)).toBe('SERVER_ERROR');
    });

    it('should classify 404 as UNKNOWN', () => {
      const error = new HttpError('Not Found', 404);
      expect(classifyApiError(error)).toBe('UNKNOWN');
    });

    it('should classify non-HttpError as UNKNOWN', () => {
      const error = new Error('Some error');
      expect(classifyApiError(error)).toBe('UNKNOWN');
    });
  });

  describe('getApiErrorMessage', () => {
    it('should return correct message for UNAUTHORIZED', () => {
      expect(getApiErrorMessage('UNAUTHORIZED')).toBe('세션이 만료되었습니다. 다시 로그인해주세요.');
    });

    it('should return correct message for FORBIDDEN', () => {
      expect(getApiErrorMessage('FORBIDDEN')).toBe('접근 권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.');
    });

    it('should return correct message for SERVER_ERROR', () => {
      expect(getApiErrorMessage('SERVER_ERROR')).toBe('일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    });

    it('should return correct message for UNKNOWN', () => {
      expect(getApiErrorMessage('UNKNOWN')).toBe('요청 처리 중 오류가 발생했습니다.');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for 500 error', () => {
      const error = new HttpError('Internal Server Error', 500);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for 502 error', () => {
      const error = new HttpError('Bad Gateway', 502);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for 401 error', () => {
      const error = new HttpError('Unauthorized', 401);
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 403 error', () => {
      const error = new HttpError('Forbidden', 403);
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for 404 error', () => {
      const error = new HttpError('Not Found', 404);
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getApiErrorDisplayProps', () => {
    it('should return correct props for 401 error', () => {
      const error = new HttpError('Unauthorized', 401);
      const props = getApiErrorDisplayProps(error);
      expect(props.severity).toBe('error');
      expect(props.message).toBe('세션이 만료되었습니다. 다시 로그인해주세요.');
      expect(props.showRetry).toBe(false);
    });

    it('should return correct props for 403 error', () => {
      const error = new HttpError('Forbidden', 403);
      const props = getApiErrorDisplayProps(error);
      expect(props.severity).toBe('warning');
      expect(props.message).toBe('접근 권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.');
      expect(props.showRetry).toBe(false);
    });

    it('should return correct props for 500 error', () => {
      const error = new HttpError('Internal Server Error', 500);
      const props = getApiErrorDisplayProps(error);
      expect(props.severity).toBe('error');
      expect(props.message).toBe('일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      expect(props.showRetry).toBe(true);
    });

    it('should return correct props for unknown error', () => {
      const error = new Error('Some error');
      const props = getApiErrorDisplayProps(error);
      expect(props.severity).toBe('error');
      expect(props.message).toBe('요청 처리 중 오류가 발생했습니다.');
      expect(props.showRetry).toBe(false);
    });
  });
});
