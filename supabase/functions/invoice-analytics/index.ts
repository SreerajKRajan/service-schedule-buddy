import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { granularity = 'monthly', start_date, end_date, status, location_id, customer_id, currency, group_by } = await req.json();

    console.log('Fetching invoice analytics with params:', { granularity, start_date, end_date });

    // Build query parameters
    const params = new URLSearchParams();
    params.append('granularity', granularity);
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (status) params.append('status', status);
    if (location_id) params.append('location_id', location_id);
    if (customer_id) params.append('customer_id', customer_id);
    if (currency) params.append('currency', currency);
    if (group_by) params.append('group_by', group_by);

    const apiUrl = `https://4ad97c94bc7e.ngrok-free.app/api/invoice/invoices/analytics/?${params.toString()}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('API error:', response.status, await response.text());
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully fetched invoice analytics');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in invoice-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
