const axios = require('axios');
const config = require('../config');
const { logger } = require('../utils/logger');

class InvoiceNinjaClient {
  constructor() {
    this.baseUrl = config.invoiceNinja.baseUrl;
    this.apiToken = config.invoiceNinja.apiToken;
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        'X-API-Token': this.apiToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logger.error('Invoice Ninja API authentication failed - check token and permissions');
          throw new Error('API authentication failed: Invalid token or insufficient permissions');
        }
        throw error;
      }
    );
  }

  async searchClients(email) {
    try {
      logger.info('Searching for client by email', email);
      
      const response = await this.client.get('/clients', {
        params: {
          filter: email,
          per_page: 50
        }
      });

      const clients = response.data.data || [];
      
      const exactMatches = clients.filter(client => 
        client.contacts?.some(contact => 
          contact.email?.toLowerCase() === email.toLowerCase()
        )
      );

      if (exactMatches.length === 1) {
        logger.info('Found exact client match', email);
        return { success: true, client: exactMatches[0], isAmbiguous: false };
      }

      if (exactMatches.length > 1) {
        logger.warn('Multiple exact matches found for email', email);
        return { 
          success: false, 
          clients: exactMatches, 
          isAmbiguous: true,
          message: 'Multiple clients found with this email' 
        };
      }

      const fuzzyMatches = clients.filter(client => 
        client.contacts?.some(contact => 
          contact.email?.toLowerCase().includes(email.toLowerCase()) ||
          email.toLowerCase().includes(contact.email?.toLowerCase() || '')
        )
      );

      if (fuzzyMatches.length > 0) {
        logger.info(`Found ${fuzzyMatches.length} fuzzy matches`, email);
        return {
          success: false,
          clients: fuzzyMatches,
          isAmbiguous: true,
          message: 'Multiple similar clients found'
        };
      }

      logger.info('No client found for email', email);
      return { 
        success: false, 
        client: null, 
        isAmbiguous: false,
        message: 'No client found with this email' 
      };

    } catch (error) {
      logger.error('Error searching for client', error, email);
      throw error;
    }
  }

  async getInvoices(clientId, limit = 12) {
    try {
      logger.info(`Fetching invoices for client ${clientId}`);
      
      const response = await this.client.get('/invoices', {
        params: {
          client_id: clientId,
          per_page: Math.min(limit, 50),
          sort: 'date|desc'
        }
      });

      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching invoices', error);
      throw error;
    }
  }

  async getPayments(clientId = null, limit = 12) {
    try {
      logger.info(`Fetching payments${clientId ? ` for client ${clientId}` : ''}`);
      
      const params = {
        per_page: Math.min(limit * 3, 100),
        sort: 'date|desc'
      };

      if (clientId) {
        params.client_id = clientId;
      }

      const response = await this.client.get('/payments', { params });
      let payments = response.data.data || [];

      if (clientId && !params.client_id) {
        payments = payments.filter(payment => 
          payment.client_id === clientId
        );
      }

      return payments.slice(0, limit);
    } catch (error) {
      logger.error('Error fetching payments', error);
      throw error;
    }
  }

  async getProducts() {
    try {
      logger.info('Fetching products from Invoice Ninja');
      
      const response = await this.client.get('/products', {
        params: {
          per_page: 100
        }
      });

      return response.data.data || [];
    } catch (error) {
      logger.error('Error fetching products', error);
      throw error;
    }
  }
}

module.exports = InvoiceNinjaClient;