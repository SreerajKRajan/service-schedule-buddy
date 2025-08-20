# Quote Webhook Documentation

## Overview
This webhook endpoint receives accepted quote data from external sources (like your website) and stores it in the system for conversion to jobs.

## Webhook URL
```
https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/quote-webhook
```

## Request Format
Send a POST request with JSON payload:

```json
{
  "customer_name": "John Doe",
  "customer_phone": "+1234567890",
  "customer_email": "john@example.com", 
  "customer_address": "123 Main St, City, State",
  "quoted_by": "John Smith",
  "jobs_selected": [
    {
      "title": "House Cleaning",
      "description": "Full house cleaning service",
      "price": 150,
      "duration": 120,
      "type": "cleaning"
    }
  ],
  "first_time": true
}
```

## Required Fields
- `customer_name` (string): Customer's full name
- `jobs_selected` (array): Array of selected services/jobs

## Optional Fields  
- `customer_phone` (string): Customer's phone number
- `customer_email` (string): Customer's email address
- `customer_address` (string): Customer's full address
- `quoted_by` (string): Name of team member who provided the quote (e.g., "John Smith"). The system will automatically look up the corresponding user ID.
- `first_time` (boolean): Whether this is the customer's first time (defaults to false)

## Response Format
### Success (200)
```json
{
  "success": true,
  "message": "Quote received successfully", 
  "id": "uuid-of-created-quote"
}
```

### Error (400/500)
```json
{
  "error": "Error message describing what went wrong"
}
```

## How It Works
1. Webhook receives the quote acceptance data
2. Data is stored in the `accepted_quotes` table
3. Quote appears in the "Accepted Quotes" tab in the admin interface
4. Admin can review and convert quotes to actual jobs
5. Converted quotes create job entries for each selected service

## Testing the Webhook
You can test the webhook using curl:

```bash
curl -X POST https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/quote-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer",
    "customer_email": "test@example.com",
    "quoted_by": "Sarah Johnson",
    "jobs_selected": [
      {
        "title": "Test Service",
        "price": 100
      }
    ],
    "first_time": true
  }'
```