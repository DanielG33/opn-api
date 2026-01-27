import { Request, Response } from 'express';
import { getSeriesById } from './series.controller';
import * as seriesService from '../../services/series.service';
import { previewTokenRepository } from '../../repositories/preview-token.repository';
import * as previewUtils from '../../utils/preview.utils';
import { Timestamp } from 'firebase-admin/firestore';

// Mock dependencies
jest.mock('../../services/series.service');
jest.mock('../../repositories/preview-token.repository');
jest.mock('../../utils/preview.utils');

describe('getSeriesById - Preview Token Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));

    mockRequest = {
      params: { id: 'series123' },
      query: {}
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock
    };

    jest.clearAllMocks();
  });

  describe('No preview token (default behavior)', () => {
    it('should return published series when no previewToken query param', async () => {
      const mockSeries = {
        id: 'series123',
        title: 'Test Series',
        publicationStatus: 'PUBLISHED'
      };

      (previewUtils.isDraftMode as jest.Mock).mockReturnValue(false);
      (seriesService.getPublicSeriesById as jest.Mock).mockResolvedValue(mockSeries);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(seriesService.getPublicSeriesById).toHaveBeenCalledWith('series123');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockSeries
      });
      expect(previewTokenRepository.validateAndTouch).not.toHaveBeenCalled();
    });

    it('should return 404 when series not found and no preview token', async () => {
      (previewUtils.isDraftMode as jest.Mock).mockReturnValue(false);
      (seriesService.getPublicSeriesById as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Series not found'
      });
    });
  });

  describe('Valid preview token', () => {
    const validToken = 'pt_' + 'a'.repeat(43);
    const mockValidatedToken = {
      id: 'token123',
      seriesId: 'series123',
      tokenHash: 'hash123',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.now(),
      lastUsedAt: Timestamp.now()
    };

    beforeEach(() => {
      mockRequest.query = { previewToken: validToken };
    });

    it('should validate token and return draft series', async () => {
      const mockDraftSeries = {
        id: 'series123',
        title: 'Draft Series',
        publicationStatus: 'DRAFT',
        isDraft: true
      };

      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(mockValidatedToken);
      (seriesService.getDraftSeriesById as jest.Mock).mockResolvedValue(mockDraftSeries);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(previewTokenRepository.validateAndTouch).toHaveBeenCalledWith('series123', validToken);
      expect(seriesService.getDraftSeriesById).toHaveBeenCalledWith('series123');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockDraftSeries
      });
    });

    it('should update token lastUsedAt and extend expiresAt via validateAndTouch', async () => {
      const mockDraftSeries = { id: 'series123', title: 'Draft Series' };

      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(mockValidatedToken);
      (seriesService.getDraftSeriesById as jest.Mock).mockResolvedValue(mockDraftSeries);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(previewTokenRepository.validateAndTouch).toHaveBeenCalledWith('series123', validToken);
      // validateAndTouch should handle updating lastUsedAt and expiresAt
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockDraftSeries
      });
    });

    it('should return 404 if draft series not found even with valid token', async () => {
      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(mockValidatedToken);
      (seriesService.getDraftSeriesById as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Series not found'
      });
    });

    it('should not call isDraftMode or assertDraftAccess when using preview token', async () => {
      const mockDraftSeries = { id: 'series123', title: 'Draft Series' };

      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(mockValidatedToken);
      (seriesService.getDraftSeriesById as jest.Mock).mockResolvedValue(mockDraftSeries);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      // Preview token should bypass auth checks
      expect(previewUtils.isDraftMode).not.toHaveBeenCalled();
      expect(previewUtils.assertDraftAccess).not.toHaveBeenCalled();
    });
  });

  describe('Invalid preview token', () => {
    const invalidToken = 'pt_invalid_token_12345';

    beforeEach(() => {
      mockRequest.query = { previewToken: invalidToken };
    });

    it('should return 403 with PREVIEW_TOKEN_INVALID error code', async () => {
      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(previewTokenRepository.validateAndTouch).toHaveBeenCalledWith('series123', invalidToken);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PREVIEW_TOKEN_INVALID',
          message: 'Preview token is invalid, expired, or revoked'
        }
      });
    });

    it('should not call series service if token validation fails', async () => {
      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(seriesService.getDraftSeriesById).not.toHaveBeenCalled();
      expect(seriesService.getPublicSeriesById).not.toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      // validateAndTouch returns null for expired tokens
      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PREVIEW_TOKEN_INVALID',
          message: 'Preview token is invalid, expired, or revoked'
        }
      });
    });

    it('should handle revoked token', async () => {
      // validateAndTouch returns null for revoked tokens
      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PREVIEW_TOKEN_INVALID',
          message: 'Preview token is invalid, expired, or revoked'
        }
      });
    });

    it('should handle token for wrong series', async () => {
      // validateAndTouch returns null if seriesId doesn't match
      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(null);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PREVIEW_TOKEN_INVALID',
          message: 'Preview token is invalid, expired, or revoked'
        }
      });
    });
  });

  describe('Draft mode (legacy auth-based)', () => {
    it('should use draft mode when mode=draft and no preview token', async () => {
      mockRequest.query = { mode: 'draft' };
      const mockDraftSeries = { id: 'series123', title: 'Draft Series' };

      (previewUtils.isDraftMode as jest.Mock).mockReturnValue(true);
      (previewUtils.assertDraftAccess as jest.Mock).mockResolvedValue(undefined);
      (seriesService.getDraftSeriesById as jest.Mock).mockResolvedValue(mockDraftSeries);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(previewUtils.isDraftMode).toHaveBeenCalledWith(mockRequest);
      expect(previewUtils.assertDraftAccess).toHaveBeenCalledWith(mockRequest, mockResponse, 'series123');
      expect(seriesService.getDraftSeriesById).toHaveBeenCalledWith('series123');
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockDraftSeries
      });
    });
  });

  describe('Priority order', () => {
    it('should prioritize preview token over draft mode', async () => {
      const validToken = 'pt_' + 'a'.repeat(43);
      mockRequest.query = {
        previewToken: validToken,
        mode: 'draft'
      };

      const mockValidatedToken = {
        id: 'token123',
        seriesId: 'series123',
        tokenHash: 'hash123',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.now()
      };
      const mockDraftSeries = { id: 'series123', title: 'Draft Series' };

      (previewTokenRepository.validateAndTouch as jest.Mock).mockResolvedValue(mockValidatedToken);
      (seriesService.getDraftSeriesById as jest.Mock).mockResolvedValue(mockDraftSeries);

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      // Should use preview token, not draft mode
      expect(previewTokenRepository.validateAndTouch).toHaveBeenCalled();
      expect(previewUtils.isDraftMode).not.toHaveBeenCalled();
      expect(previewUtils.assertDraftAccess).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should return 500 on unexpected error', async () => {
      const error = new Error('Database connection failed');
      (previewUtils.isDraftMode as jest.Mock).mockReturnValue(false);
      (seriesService.getPublicSeriesById as jest.Mock).mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch series'
      });

      consoleErrorSpy.mockRestore();
    });

    it('should return 500 if validateAndTouch throws error', async () => {
      mockRequest.query = { previewToken: 'pt_' + 'a'.repeat(43) };
      const error = new Error('Firestore error');
      
      (previewTokenRepository.validateAndTouch as jest.Mock).mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await getSeriesById(mockRequest as Request, mockResponse as Response);

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch series'
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
