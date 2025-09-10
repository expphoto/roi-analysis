# ROI Analysis Tool for Invoice Ninja v5

A secure backend + frontend application that provides ROI analysis for Invoice Ninja v5 clients, showing recent invoices, payments, and savings calculations.

## Features

- **Secure Authentication**: Magic link-based authentication with rate limiting
- **Client Lookup**: Exact and fuzzy email matching with disambiguation
- **ROI Calculations**: 12-month billing/payment analysis, on-time rates, and savings vs list price
- **Benefits Mapping**: Product-to-benefits visualization
- **Clean UI**: Simple single-page application for viewing ROI data

## Quick Start

### Prerequisites

- Node.js 16+ 
- Invoice Ninja v5 instance with API access
- Valid API token with client/invoice/payment read permissions

### Installation

```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your Invoice Ninja details
vim .env
```

### Required Environment Variables

```bash
IN_NINJA_BASE_URL=https://app.invoicing.co  # Your Invoice Ninja base URL
IN_NINJA_API_TOKEN=your_api_token_here      # Your API token
PORT=3000                                   # Server port (optional)
```

### Run the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode  
npm start

# Run tests
npm test
```

### Access the Application

1. Open http://localhost:3000
2. Enter a client email address
3. Check console for magic link (in development)
4. Click the magic link to view ROI analysis

## API Endpoints

### POST /api/request-access
Request a magic link for email access.

**Request:**
```json
{
  "email": "client@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Access link sent to your email"
}
```

### GET /api/roi?email={email}&token={token}
Get complete ROI data (server endpoint).

**Response:**
```json
{
  "client": {"id": "1", "name": "Test Client", "email": "client@example.com"},
  "metrics": {
    "billed_12m": 12000,
    "paid_12m": 11400,
    "on_time_rate": 0.85,
    "savings_vs_list": 2400,
    "should_be": 1200
  },
  "recent_invoices": [...],
  "recent_payments": [...],
  "benefits": [...]
}
```

### GET /api/roi/ui?email={email}&token={token}
Get ROI data formatted for UI consumption.

## Configuration Files

### data/pricebook.json
Contains list prices for products not found in Invoice Ninja:

```json
{
  "products": {
    "EDR": {
      "name": "Endpoint Detection & Response",
      "list_price": 15.00
    }
  }
}
```

### data/benefits.json  
Maps product keys to benefit descriptions:

```json
{
  "benefits": {
    "EDR": {
      "bullets": [
        "24/7 endpoint monitoring",
        "Ransomware containment"
      ]
    }
  }
}
```

### data/plan_rules.json
Defines pricing plans for "should be paying" calculations:

```json
{
  "plans": {
    "basic": {
      "name": "Basic Security Package",
      "per_seat": 25.00,
      "includes": ["EDR"]
    }
  }
}
```

## Security Features

- **Rate Limiting**: 10 ROI requests per 15 minutes, 3 magic link requests per minute
- **Magic Links**: 15-minute expiry, single-use tokens
- **Server-side API**: All Invoice Ninja calls happen server-side only
- **Email Hashing**: Only hashed emails logged, never API tokens
- **HTTPS Headers**: Security headers via Helmet.js

## Testing

The application includes comprehensive unit tests for edge cases:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

**Test Coverage Includes:**
- Exact vs fuzzy email matching
- No invoices scenarios  
- No payments scenarios
- Multiple client contacts
- Authentication flows
- Error handling

## Troubleshooting

### API Authentication Errors

If you see "Invoice Ninja API authentication failed":

1. Verify your `IN_NINJA_API_TOKEN` is correct
2. Check token permissions include clients, invoices, payments
3. Confirm your Invoice Ninja plan supports API access
4. Test API token with curl:

```bash
curl -H "X-API-Token: YOUR_TOKEN" \
     -H "Accept: application/json" \
     https://your-ninja-url/api/v1/clients
```

### Client Not Found

- Ensure the email exists in Invoice Ninja client contacts
- Check for typos in email address
- Try searching in Invoice Ninja admin panel first

### Rate Limiting

If requests are blocked:
- Wait 15 minutes for ROI request limits to reset
- Wait 1 minute for magic link request limits to reset

## Architecture

```
src/
├── config.js              # Environment configuration
├── server.js              # Express server setup
├── routes/
│   └── api.js             # API route handlers
├── services/
│   ├── invoiceNinjaClient.js  # Invoice Ninja API client
│   ├── roiService.js          # ROI calculation logic
│   └── authService.js         # Magic link authentication
├── middleware/
│   └── rateLimiter.js     # Rate limiting configuration
├── utils/
│   └── logger.js          # Logging utilities
└── tests/                 # Unit tests
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Invoice Ninja v5 API documentation
3. Check server logs for detailed error messages