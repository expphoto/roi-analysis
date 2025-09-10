const fs = require('fs').promises;
const path = require('path');
const InvoiceNinjaClient = require('./invoiceNinjaClient');
const config = require('../config');
const { logger } = require('../utils/logger');

class ROIService {
  constructor() {
    this.invoiceNinja = new InvoiceNinjaClient();
    this.pricebook = null;
    this.benefits = null;
    this.planRules = null;
  }

  async loadDataFiles() {
    try {
      if (!this.pricebook) {
        const pricebookPath = path.resolve(config.dataFiles.pricebook);
        const pricebookData = await fs.readFile(pricebookPath, 'utf8');
        this.pricebook = JSON.parse(pricebookData);
      }

      if (!this.benefits) {
        const benefitsPath = path.resolve(config.dataFiles.benefits);
        const benefitsData = await fs.readFile(benefitsPath, 'utf8');
        this.benefits = JSON.parse(benefitsData);
      }

      if (!this.planRules) {
        const planRulesPath = path.resolve(config.dataFiles.planRules);
        const planRulesData = await fs.readFile(planRulesPath, 'utf8');
        this.planRules = JSON.parse(planRulesData);
      }
    } catch (error) {
      logger.error('Error loading data files', error);
      throw error;
    }
  }

  async getClientROI(email) {
    try {
      await this.loadDataFiles();
      
      logger.info('Starting ROI analysis', email);

      const clientResult = await this.invoiceNinja.searchClients(email);
      
      if (!clientResult.success) {
        return clientResult;
      }

      const client = clientResult.client;
      const clientId = client.id;

      const [invoices, payments, products] = await Promise.all([
        this.invoiceNinja.getInvoices(clientId, 12),
        this.invoiceNinja.getPayments(clientId, 12),
        this.invoiceNinja.getProducts()
      ]);

      const metrics = this.calculateMetrics(invoices, payments);
      const savingsVsList = this.calculateSavingsVsList(invoices, products);
      const shouldBePaying = this.calculateShouldBePaying(invoices);
      const benefits = this.extractBenefits(invoices);

      const recentInvoices = this.formatInvoices(invoices.slice(0, 6));
      const recentPayments = this.formatPayments(payments.slice(0, 6), invoices);

      logger.info('ROI analysis completed successfully', email);

      return {
        success: true,
        data: {
          client: {
            id: client.id,
            name: client.name,
            email: email
          },
          metrics: {
            ...metrics,
            savings_vs_list: savingsVsList,
            should_be: shouldBePaying
          },
          recent_invoices: recentInvoices,
          recent_payments: recentPayments,
          benefits: benefits
        }
      };

    } catch (error) {
      logger.error('Error in ROI analysis', error, email);
      throw error;
    }
  }

  calculateMetrics(invoices, payments) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const recentInvoices = invoices.filter(invoice => 
      new Date(invoice.date) >= twelveMonthsAgo
    );

    const recentPayments = payments.filter(payment => 
      new Date(payment.date) >= twelveMonthsAgo
    );

    const billed12m = recentInvoices.reduce((sum, invoice) => 
      sum + (parseFloat(invoice.amount) || 0), 0
    );

    let paid12m = 0;
    let onTimePaymentCount = 0;
    let eligibleInvoiceCount = 0;

    for (const invoice of recentInvoices) {
      if (!invoice.due_date) continue;
      eligibleInvoiceCount++;

      let invoicePaidAmount = 0;
      let earliestPaymentDate = null;

      for (const payment of recentPayments) {
        if (!payment.invoices) continue;

        for (const paymentInvoice of payment.invoices) {
          if (paymentInvoice.invoice_id === invoice.id) {
            const paymentAmount = parseFloat(paymentInvoice.amount) || 0;
            
            if (payment.type === 'refund' || paymentAmount < 0) {
              invoicePaidAmount -= Math.abs(paymentAmount);
            } else {
              invoicePaidAmount += paymentAmount;
            }

            const paymentDate = new Date(payment.date);
            if (!earliestPaymentDate || paymentDate < earliestPaymentDate) {
              earliestPaymentDate = paymentDate;
            }
          }
        }
      }

      paid12m += Math.max(0, invoicePaidAmount);

      if (earliestPaymentDate && earliestPaymentDate <= new Date(invoice.due_date)) {
        onTimePaymentCount++;
      }
    }

    for (const payment of recentPayments) {
      if (!payment.invoices || payment.invoices.length === 0) {
        const paymentAmount = parseFloat(payment.amount) || 0;
        if (payment.type === 'credit' && paymentAmount > 0) {
          paid12m += paymentAmount;
        }
      }
    }

    const onTimeRate = eligibleInvoiceCount > 0 ? 
      onTimePaymentCount / eligibleInvoiceCount : 0;

    return {
      billed_12m: Math.round(billed12m * 100) / 100,
      paid_12m: Math.round(paid12m * 100) / 100,
      on_time_rate: Math.round(onTimeRate * 1000) / 1000
    };
  }

  calculateSavingsVsList(invoices, products) {
    let totalSavings = 0;

    for (const invoice of invoices) {
      if (!invoice.line_items) continue;

      for (const line of invoice.line_items) {
        if (this.isNonDiscountLineType(line)) {
          continue;
        }

        const productKey = line.product_key;
        const quantity = Math.max(0, parseFloat(line.quantity) || 0);
        const unitCost = Math.max(0, parseFloat(line.cost) || 0);
        const lineDiscount = Math.max(0, parseFloat(line.discount) || 0);

        if (quantity === 0) continue;

        let listPrice = 0;

        if (productKey) {
          const product = products.find(p => p.product_key === productKey);
          if (product && product.price) {
            listPrice = parseFloat(product.price);
          } else if (this.pricebook.products[productKey]) {
            listPrice = this.pricebook.products[productKey].list_price;
          }
        }

        if (listPrice > 0 && listPrice > unitCost) {
          const perUnitSavings = Math.max(0, listPrice - unitCost - lineDiscount);
          const lineSavings = perUnitSavings * quantity;
          
          const maxReasonableSavings = listPrice * quantity * 0.95;
          const cappedSavings = Math.min(lineSavings, maxReasonableSavings);
          
          totalSavings += Math.max(0, cappedSavings);
        }
      }
    }

    return Math.round(Math.max(0, totalSavings) * 100) / 100;
  }

  isNonDiscountLineType(line) {
    const lineType = line.type_id || line.product_type || '';
    const description = (line.description || '').toLowerCase();
    
    const excludeTypes = ['tax', 'shipping', 'fee', 'adjustment'];
    const excludeDescriptions = ['tax', 'shipping', 'fee', 'late fee', 'setup fee'];
    
    if (excludeTypes.includes(lineType.toLowerCase())) {
      return true;
    }
    
    for (const excludeDesc of excludeDescriptions) {
      if (description.includes(excludeDesc)) {
        return true;
      }
    }
    
    return false;
  }

  calculateShouldBePaying(invoices) {
    const productCounts = {};

    for (const invoice of invoices) {
      if (!invoice.line_items) continue;

      for (const line of invoice.line_items) {
        const productKey = line.product_key;
        const quantity = parseFloat(line.quantity) || 0;
        
        if (productKey) {
          productCounts[productKey] = (productCounts[productKey] || 0) + quantity;
        }
      }
    }

    let bestPlan = null;
    let bestPrice = Infinity;

    for (const [planName, plan] of Object.entries(this.planRules.plans)) {
      const totalQuantity = Object.keys(productCounts).reduce((sum, key) => {
        return plan.includes.includes(key) ? sum + productCounts[key] : sum;
      }, 0);

      if (totalQuantity > 0) {
        const monthlyPrice = totalQuantity * plan.per_seat;
        if (monthlyPrice < bestPrice) {
          bestPrice = monthlyPrice;
          bestPlan = plan;
        }
      }
    }

    return bestPrice === Infinity ? 0 : Math.round(bestPrice * 100) / 100;
  }

  extractBenefits(invoices) {
    const productKeys = new Set();

    for (const invoice of invoices) {
      if (!invoice.line_items) continue;

      for (const line of invoice.line_items) {
        if (line.product_key) {
          productKeys.add(line.product_key);
        }
      }
    }

    const benefits = [];
    
    for (const productKey of productKeys) {
      if (this.benefits.benefits[productKey]) {
        benefits.push({
          product_key: productKey,
          bullets: this.benefits.benefits[productKey].bullets
        });
      }
    }

    return benefits;
  }

  formatInvoices(invoices) {
    return invoices.map(invoice => ({
      number: invoice.number || '',
      date: invoice.date || '',
      due_date: invoice.due_date || '',
      amount: Math.round((parseFloat(invoice.amount) || 0) * 100) / 100,
      status: invoice.status_id ? this.getInvoiceStatus(invoice.status_id) : 'unknown'
    }));
  }

  formatPayments(payments, invoices) {
    return payments.map(payment => {
      const appliedInvoice = payment.invoices?.[0];
      const invoice = appliedInvoice ? 
        invoices.find(inv => inv.id === appliedInvoice.invoice_id) : null;

      return {
        date: payment.date || '',
        amount: Math.round((parseFloat(payment.amount) || 0) * 100) / 100,
        method: payment.type_id ? this.getPaymentMethod(payment.type_id) : 'unknown',
        applied_to: invoice ? invoice.number : 'N/A'
      };
    });
  }

  getInvoiceStatus(statusId) {
    const statuses = {
      1: 'draft',
      2: 'sent', 
      3: 'viewed',
      4: 'approved',
      5: 'partial',
      6: 'paid'
    };
    return statuses[statusId] || 'unknown';
  }

  getPaymentMethod(typeId) {
    const methods = {
      1: 'credit_card',
      2: 'bank_transfer',
      3: 'paypal',
      4: 'cash',
      5: 'check',
      6: 'credit'
    };
    return methods[typeId] || 'unknown';
  }
}

module.exports = ROIService;