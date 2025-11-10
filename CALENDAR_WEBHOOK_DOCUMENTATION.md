# Calendar Import Webhook Documentation

## Overview
This webhook endpoint receives external appointment data and stores it in the system for display on the global calendar alongside job appointments.

## Webhook URL
```
https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/calendar-import-webhook
```

## Request Format
Send a POST request with JSON payload:

```json
{
  "type": "AppointmentCreate",
  "locationId": "0007BWpSzSwfiuSl0tR2",
  "appointment": {
    "id": "0007BWpSzSwfiuSl0tR2",
    "address": "https://example.com/meeting",
    "title": "Appointment with GHL Dev team",
    "calendarId": "BqTwX8QFwXzpegMve9EQ",
    "contactId": "9NkT25Vor1v4aQatFsv2",
    "groupId": "9NkT25Vor1v4aQatFsv2",
    "appointmentStatus": "confirmed",
    "assignedUserId": "John Smith",
    "users": ["Sarah Johnson", "Mike Davis"],
    "notes": "Some dummy note",
    "source": "booking_widget",
    "startTime": "2023-09-25T16:00:00+05:30",
    "endTime": "2023-09-25T16:00:00+05:30",
    "dateAdded": "2023-09-25T16:00:00+05:30",
    "dateUpdated": "2023-09-25T16:00:00+05:30"
  }
}
```

## Required Fields
- `appointment.id` (string): Unique external appointment ID
- `appointment.title` (string): Appointment title
- `appointment.startTime` (string): ISO 8601 formatted start date and time
- `appointment.endTime` (string): ISO 8601 formatted end date and time

## Optional Fields  
- `locationId` (string): External location identifier
- `appointment.address` (string): Meeting location or URL
- `appointment.calendarId` (string): External calendar ID
- `appointment.contactId` (string): External contact ID
- `appointment.groupId` (string): External group ID
- `appointment.appointmentStatus` (string): Status (defaults to "confirmed")
- `appointment.assignedUserId` (string): User name that will be mapped to system user ID
- `appointment.users` (array): Array of user names that will be mapped to system user IDs
- `appointment.notes` (string): Additional notes
- `appointment.source` (string): Appointment source (e.g., "booking_widget")

## User Name Mapping
The webhook automatically maps user names to system user IDs:
- `assignedUserId`: Can contain a user name (e.g., "John Smith") which will be looked up in the users table
- `users`: Array of user names that will be looked up and stored as assigned users

## Response Format
### Success (200)
```json
{
  "success": true,
  "message": "Appointment created successfully", 
  "id": "uuid-of-created-appointment",
  "external_id": "external-appointment-id"
}
```

### Update Success (200)
```json
{
  "success": true,
  "message": "Appointment updated successfully", 
  "id": "uuid-of-appointment",
  "external_id": "external-appointment-id"
}
```

### Error (400/500)
```json
{
  "error": "Error message describing what went wrong"
}
```

## How It Works
1. Webhook receives the appointment data from external integrations
2. Maps user names to system user IDs
3. Checks if appointment already exists by `external_id`
4. Updates existing appointment or creates new one
5. Appointment appears in the calendar view with cyan color
6. Users can filter between "Jobs Only", "External Only", or "All Appointments"

## Calendar Integration
External appointments are displayed in the calendar alongside job appointments:
- **Jobs**: Colored by status (pending=orange, in_progress=blue, completed=green, cancelled=red)
- **External Appointments**: Cyan color
- **Accepted Quotes**: Purple color

## Filter Options
Users can filter the calendar by appointment type:
- **All Appointments**: Shows both jobs and external appointments
- **Jobs Only**: Shows only job appointments
- **External Only**: Shows only external appointments

## Testing the Webhook
You can test the webhook using curl:

```bash
curl -X POST https://spelxsmrpbswmmahwzyg.supabase.co/functions/v1/calendar-import-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AppointmentCreate",
    "locationId": "test-location",
    "appointment": {
      "id": "test-appt-123",
      "title": "Test External Meeting",
      "address": "https://zoom.us/meeting/123",
      "appointmentStatus": "confirmed",
      "assignedUserId": "Sarah Johnson",
      "users": ["Mike Davis", "John Smith"],
      "notes": "This is a test appointment",
      "source": "api_test",
      "startTime": "2025-12-01T14:00:00Z",
      "endTime": "2025-12-01T15:00:00Z"
    }
  }'
```

## Database Storage
External appointments are stored in the `appointments` table with the following fields:
- `id`: Internal UUID
- `external_id`: Unique external appointment ID
- `location_id`: External location ID
- `address`: Meeting location or URL
- `title`: Appointment title
- `calendar_id`: External calendar ID
- `contact_id`: External contact ID
- `group_id`: External group ID
- `appointment_status`: Appointment status
- `assigned_user_id`: UUID of assigned user (mapped from name)
- `assigned_users`: Array of UUIDs for assigned users (mapped from names)
- `notes`: Additional notes
- `source`: Appointment source
- `start_time`: Start date/time
- `end_time`: End date/time
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
