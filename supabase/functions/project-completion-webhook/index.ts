import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId } = await req.json();
    
    console.log('Processing project completion webhook for job:', jobId);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Error fetching job:', jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get quoted by user name
    let quotedByName = '';
    if (job.quoted_by) {
      const { data: quotedUser, error: quotedUserError } = await supabase
        .from('users')
        .select('name')
        .eq('id', job.quoted_by)
        .single();

      if (!quotedUserError && quotedUser) {
        quotedByName = quotedUser.name;
      }
    }

    // Get job services
    const { data: jobServices, error: servicesError } = await supabase
      .from('job_services')
      .select('service_name, service_description, price')
      .eq('job_id', jobId);

    if (servicesError) {
      console.error('Error fetching job services:', servicesError);
    }

    const selectedServices = jobServices?.map(service => ({
      name: service.service_name,
      description: service.service_description,
      price: service.price || 0
    })) || [];

    // Prepare webhook payload with customer info and services
    const webhookPayload = {
      customer_name: job.customer_name || '',
      customer_email: job.customer_email || '',
      customer_phone: job.customer_phone || '',
      selected_services: selectedServices
    };

    console.log('Sending webhook payload:', webhookPayload);

    // Send webhook to the specified URL
    const webhookResponse = await fetch('https://webhook.site/90ed311d-0949-4923-9d72-34169fae2119', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('Webhook failed:', await webhookResponse.text());
      return new Response(JSON.stringify({ error: 'Webhook failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Webhook sent successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in project-completion-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});