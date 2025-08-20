import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://webhook.site/c78f6ac6-0b0b-4af4-8f92-f5ba89c7aa9f';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Testing webhook connectivity...');

    // Test payload
    const testPayload = {
      test: true,
      message: "Testing webhook connectivity",
      timestamp: new Date().toISOString(),
      job_id: "test-job-123",
      notification_type: "test_notification"
    };

    console.log('Sending test payload:', JSON.stringify(testPayload, null, 2));

    // Send webhook
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('Webhook response status:', webhookResponse.status);
    console.log('Webhook response headers:', Object.fromEntries(webhookResponse.headers.entries()));

    const responseText = await webhookResponse.text();
    console.log('Webhook response body:', responseText);

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed with status ${webhookResponse.status}: ${responseText}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test webhook sent successfully',
      webhook_status: webhookResponse.status,
      webhook_response: responseText,
      sent_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-webhook function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});