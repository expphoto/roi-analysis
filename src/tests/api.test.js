const request = require('supertest');
const express = require('express');
const apiRoutes = require('../routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

jest.mock('../services/roiService');
jest.mock('../services/authService');

const ROIService = require('../services/roiService');
const AuthService = require('../services/authService');

describe('API Routes', () => {
  let mockROIService;
  let mockAuthService;

  beforeEach(() => {
    mockROIService = {
      getClientROI: jest.fn()
    };
    mockAuthService = {
      generateMagicLink: jest.fn(),
      sendMagicLink: jest.fn(),
      validateMagicLink: jest.fn()
    };

    ROIService.mockImplementation(() => mockROIService);
    AuthService.mockImplementation(() => mockAuthService);
  });

  describe('POST /api/request-access', () => {
    test('should generate and send magic link for valid email', async () => {
      mockAuthService.generateMagicLink.mockReturnValue('test-token');
      mockAuthService.sendMagicLink.mockReturnValue(true);

      const response = await request(app)
        .post('/api/request-access')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Access link sent to your email');
      expect(mockAuthService.generateMagicLink).toHaveBeenCalledWith('test@example.com');
    });

    test('should reject invalid email addresses', async () => {
      const response = await request(app)
        .post('/api/request-access')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid email address is required');
    });

    test('should handle missing email', async () => {
      const response = await request(app)
        .post('/api/request-access')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Valid email address is required');
    });
  });

  describe('GET /api/roi', () => {
    test('should return ROI data for valid request', async () => {
      const mockROIData = {
        success: true,
        data: {
          client: { id: 1, name: 'Test Client', email: 'test@example.com' },
          metrics: { billed_12m: 1000, paid_12m: 950, on_time_rate: 0.85, savings_vs_list: 200 },
          recent_invoices: [],
          recent_payments: [],
          benefits: []
        }
      };

      mockAuthService.validateMagicLink.mockReturnValue(true);
      mockROIService.getClientROI.mockResolvedValue(mockROIData);

      const response = await request(app)
        .get('/api/roi')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(200);
      expect(response.body.client.email).toBe('test@example.com');
      expect(response.body.metrics.billed_12m).toBe(1000);
    });

    test('should reject request without email', async () => {
      const response = await request(app)
        .get('/api/roi')
        .query({ token: 'valid-token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email parameter is required');
    });

    test('should reject request with invalid token', async () => {
      mockAuthService.validateMagicLink.mockReturnValue(false);

      const response = await request(app)
        .get('/api/roi')
        .query({ email: 'test@example.com', token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Valid authentication token is required');
    });

    test('should handle ambiguous client results', async () => {
      const ambiguousResult = {
        success: false,
        isAmbiguous: true,
        message: 'Multiple clients found',
        clients: [
          { id: 1, name: 'Client 1' },
          { id: 2, name: 'Client 2' }
        ]
      };

      mockAuthService.validateMagicLink.mockReturnValue(true);
      mockROIService.getClientROI.mockResolvedValue(ambiguousResult);

      const response = await request(app)
        .get('/api/roi')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Multiple clients found');
      expect(response.body.clients).toHaveLength(2);
    });

    test('should handle client not found', async () => {
      const notFoundResult = {
        success: false,
        isAmbiguous: false,
        message: 'No client found with this email'
      };

      mockAuthService.validateMagicLink.mockReturnValue(true);
      mockROIService.getClientROI.mockResolvedValue(notFoundResult);

      const response = await request(app)
        .get('/api/roi')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No client found with this email');
    });

    test('should handle Invoice Ninja authentication errors', async () => {
      mockAuthService.validateMagicLink.mockReturnValue(true);
      mockROIService.getClientROI.mockRejectedValue(new Error('API authentication failed'));

      const response = await request(app)
        .get('/api/roi')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invoice Ninja API authentication failed. Please contact administrator.');
    });

    test('should handle general errors', async () => {
      mockAuthService.validateMagicLink.mockReturnValue(true);
      mockROIService.getClientROI.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/roi')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to retrieve ROI data');
    });
  });

  describe('GET /api/roi/ui', () => {
    test('should return same data as /api/roi endpoint', async () => {
      const mockROIData = {
        success: true,
        data: {
          client: { id: 1, name: 'Test Client', email: 'test@example.com' },
          metrics: { billed_12m: 1000, paid_12m: 950, on_time_rate: 0.85, savings_vs_list: 200 },
          recent_invoices: [],
          recent_payments: [],
          benefits: []
        }
      };

      mockAuthService.validateMagicLink.mockReturnValue(true);
      mockROIService.getClientROI.mockResolvedValue(mockROIData);

      const response = await request(app)
        .get('/api/roi/ui')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockROIData.data);
    });
  });

  describe('GET /api/verify', () => {
    test('should redirect to dashboard for valid token', async () => {
      mockAuthService.validateMagicLink.mockReturnValue(true);

      const response = await request(app)
        .get('/api/verify')
        .query({ email: 'test@example.com', token: 'valid-token' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/roi-analysis.html');
    });

    test('should show error page for invalid token', async () => {
      mockAuthService.validateMagicLink.mockReturnValue(false);

      const response = await request(app)
        .get('/api/verify')
        .query({ email: 'test@example.com', token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Invalid or Expired Link');
    });

    test('should handle missing parameters', async () => {
      const response = await request(app)
        .get('/api/verify')
        .query({});

      expect(response.status).toBe(400);
      expect(response.text).toContain('Invalid Link');
    });
  });
});