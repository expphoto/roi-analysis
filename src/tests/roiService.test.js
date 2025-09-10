const ROIService = require('../services/roiService');
const InvoiceNinjaClient = require('../services/invoiceNinjaClient');

jest.mock('../services/invoiceNinjaClient');

describe('ROIService', () => {
  let roiService;
  let mockInvoiceNinja;

  beforeEach(() => {
    roiService = new ROIService();
    mockInvoiceNinja = {
      searchClients: jest.fn(),
      getInvoices: jest.fn(),
      getPayments: jest.fn(),
      getProducts: jest.fn()
    };
    roiService.invoiceNinja = mockInvoiceNinja;
    
    roiService.pricebook = {
      products: {
        'EDR': { name: 'Endpoint Detection', list_price: 15.00 },
        'MDM': { name: 'Mobile Device Management', list_price: 8.00 }
      }
    };
    
    roiService.benefits = {
      benefits: {
        'EDR': { bullets: ['24/7 monitoring', 'Ransomware protection'] },
        'MDM': { bullets: ['Device management', 'Remote wipe'] }
      }
    };
    
    roiService.planRules = {
      plans: {
        'basic': { name: 'Basic Plan', per_seat: 25.00, includes: ['EDR'] },
        'standard': { name: 'Standard Plan', per_seat: 40.00, includes: ['EDR', 'MDM'] }
      }
    };
  });

  describe('exact-match vs fuzzy email', () => {
    test('should return exact match when single client has exact email', async () => {
      const email = 'test@example.com';
      const mockClient = {
        id: 1,
        name: 'Test Client',
        contacts: [{ email: 'test@example.com' }]
      };

      mockInvoiceNinja.searchClients.mockResolvedValue({
        success: true,
        client: mockClient,
        isAmbiguous: false
      });
      
      mockInvoiceNinja.getInvoices.mockResolvedValue([]);
      mockInvoiceNinja.getPayments.mockResolvedValue([]);
      mockInvoiceNinja.getProducts.mockResolvedValue([]);

      const result = await roiService.getClientROI(email);

      expect(result.success).toBe(true);
      expect(result.data.client.email).toBe(email);
      expect(mockInvoiceNinja.searchClients).toHaveBeenCalledWith(email);
    });

    test('should handle fuzzy matches when no exact match exists', async () => {
      const email = 'test@example.com';

      mockInvoiceNinja.searchClients.mockResolvedValue({
        success: false,
        clients: [
          { id: 1, name: 'Similar Client 1', contacts: [{ email: 'test1@example.com' }] },
          { id: 2, name: 'Similar Client 2', contacts: [{ email: 'test2@example.com' }] }
        ],
        isAmbiguous: true,
        message: 'Multiple similar clients found'
      });

      const result = await roiService.getClientROI(email);

      expect(result.success).toBe(false);
      expect(result.isAmbiguous).toBe(true);
      expect(result.clients).toHaveLength(2);
    });

    test('should handle multiple exact matches', async () => {
      const email = 'shared@example.com';

      mockInvoiceNinja.searchClients.mockResolvedValue({
        success: false,
        clients: [
          { id: 1, name: 'Client 1', contacts: [{ email: 'shared@example.com' }] },
          { id: 2, name: 'Client 2', contacts: [{ email: 'shared@example.com' }] }
        ],
        isAmbiguous: true,
        message: 'Multiple clients found with this email'
      });

      const result = await roiService.getClientROI(email);

      expect(result.success).toBe(false);
      expect(result.isAmbiguous).toBe(true);
      expect(result.message).toBe('Multiple clients found with this email');
    });
  });

  describe('no invoices scenario', () => {
    test('should handle client with no invoices', async () => {
      const email = 'noinvoices@example.com';
      const mockClient = {
        id: 1,
        name: 'No Invoices Client',
        contacts: [{ email: 'noinvoices@example.com' }]
      };

      mockInvoiceNinja.searchClients.mockResolvedValue({
        success: true,
        client: mockClient,
        isAmbiguous: false
      });
      
      mockInvoiceNinja.getInvoices.mockResolvedValue([]);
      mockInvoiceNinja.getPayments.mockResolvedValue([]);
      mockInvoiceNinja.getProducts.mockResolvedValue([]);

      const result = await roiService.getClientROI(email);

      expect(result.success).toBe(true);
      expect(result.data.metrics.billed_12m).toBe(0);
      expect(result.data.metrics.paid_12m).toBe(0);
      expect(result.data.metrics.on_time_rate).toBe(0);
      expect(result.data.recent_invoices).toEqual([]);
      expect(result.data.benefits).toEqual([]);
    });
  });

  describe('no payments scenario', () => {
    test('should handle client with invoices but no payments', async () => {
      const email = 'nopayments@example.com';
      const mockClient = {
        id: 1,
        name: 'No Payments Client',
        contacts: [{ email: 'nopayments@example.com' }]
      };

      const mockInvoices = [
        {
          id: 1,
          number: 'INV-001',
          date: '2023-12-01',
          due_date: '2023-12-31',
          amount: 100.00,
          status_id: 2,
          line_items: [
            { product_key: 'EDR', quantity: 1, cost: 10.00, discount: 0 }
          ]
        }
      ];

      mockInvoiceNinja.searchClients.mockResolvedValue({
        success: true,
        client: mockClient,
        isAmbiguous: false
      });
      
      mockInvoiceNinja.getInvoices.mockResolvedValue(mockInvoices);
      mockInvoiceNinja.getPayments.mockResolvedValue([]);
      mockInvoiceNinja.getProducts.mockResolvedValue([]);

      const result = await roiService.getClientROI(email);

      expect(result.success).toBe(true);
      expect(result.data.metrics.billed_12m).toBe(100);
      expect(result.data.metrics.paid_12m).toBe(0);
      expect(result.data.metrics.on_time_rate).toBe(0);
      expect(result.data.recent_payments).toEqual([]);
    });
  });

  describe('multiple contacts scenario', () => {
    test('should handle client with multiple contacts', async () => {
      const email = 'primary@example.com';
      const mockClient = {
        id: 1,
        name: 'Multi Contact Client',
        contacts: [
          { email: 'primary@example.com' },
          { email: 'secondary@example.com' },
          { email: 'billing@example.com' }
        ]
      };

      mockInvoiceNinja.searchClients.mockResolvedValue({
        success: true,
        client: mockClient,
        isAmbiguous: false
      });
      
      mockInvoiceNinja.getInvoices.mockResolvedValue([]);
      mockInvoiceNinja.getPayments.mockResolvedValue([]);
      mockInvoiceNinja.getProducts.mockResolvedValue([]);

      const result = await roiService.getClientROI(email);

      expect(result.success).toBe(true);
      expect(result.data.client.email).toBe(email);
      expect(result.data.client.name).toBe('Multi Contact Client');
    });
  });

  describe('calculateMetrics', () => {
    test('should calculate metrics correctly with mixed date ranges', () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 18);
      
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 6);

      const invoices = [
        { date: oldDate.toISOString(), amount: 50 },
        { date: recentDate.toISOString(), amount: 100, due_date: recentDate.toISOString() }
      ];

      const payments = [
        { date: recentDate.toISOString(), amount: 75 }
      ];

      const metrics = roiService.calculateMetrics(invoices, payments);

      expect(metrics.billed_12m).toBe(100);
      expect(metrics.paid_12m).toBe(75);
    });
  });

  describe('calculateSavingsVsList', () => {
    test('should calculate savings when product keys match pricebook', () => {
      const invoices = [
        {
          line_items: [
            { product_key: 'EDR', quantity: 10, cost: 10.00, discount: 0 },
            { product_key: 'MDM', quantity: 5, cost: 5.00, discount: 1.00 }
          ]
        }
      ];

      const savings = roiService.calculateSavingsVsList(invoices, []);

      expect(savings).toBe(60);
    });

    test('should handle missing product keys gracefully', () => {
      const invoices = [
        {
          line_items: [
            { product_key: 'UNKNOWN', quantity: 1, cost: 10.00, discount: 0 },
            { quantity: 1, cost: 5.00, discount: 0 }
          ]
        }
      ];

      const savings = roiService.calculateSavingsVsList(invoices, []);

      expect(savings).toBe(0);
    });
  });
});