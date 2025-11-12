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

    // Check if webhook was already sent to prevent duplicates
    if (job.webhook_sent_at) {
      console.log('Webhook already sent at:', job.webhook_sent_at, 'for job:', jobId);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Webhook already sent previously',
        sent_at: job.webhook_sent_at 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('First time sending webhook for job:', jobId);

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

    // Get assigned employees
    const { data: assignments, error: assignmentsError } = await supabase
      .from('job_assignments')
      .select(`
        users (name)
      `)
      .eq('job_id', jobId);

    const employeesAssigned = assignments?.map(assignment => assignment.users?.name).filter(Boolean) || [];

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

    // Prepare original webhook payload
    const originalWebhookPayload = {
      project_value: job.price || 0,
      project_title: job.title,
      quoted_by_name: quotedByName,
      first_time: job.first_time || false,
      employees_assigned: employeesAssigned
    };

    // Prepare customer info webhook payload
    const customerWebhookPayload = {
      customer_name: job.customer_name || '',
      customer_email: job.customer_email || '',
      customer_phone: job.customer_phone || '',
      customer_address: job.customer_address || '',
      selected_services: selectedServices
    };

    console.log('Sending original webhook payload:', originalWebhookPayload);
    console.log('Sending customer webhook payload:', customerWebhookPayload);

    // Send to original webhook
    const originalWebhookResponse = await fetch('https://bhcobewqjkvptmojaoep.supabase.co/functions/v1/project-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY'),
      },
      body: JSON.stringify(originalWebhookPayload),
    });

    if (!originalWebhookResponse.ok) {
      console.error('Original webhook failed:', await originalWebhookResponse.text());
    } else {
      console.log('Original webhook sent successfully');
    }

    // Send to customer info webhook
    const customerWebhookResponse = await fetch('https://workorder.theservicepilot.com/api/webhook/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerWebhookPayload),
    });

    if (!customerWebhookResponse.ok) {
      console.error('Customer webhook failed:', await customerWebhookResponse.text());
    } else {
      console.log('Customer webhook sent successfully');
    }

    // Return success if at least one webhook succeeded
    if (!originalWebhookResponse.ok && !customerWebhookResponse.ok) {
      return new Response(JSON.stringify({ error: 'Both webhooks failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atomically update status, completed_date, and webhook_sent_at
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ 
        status: 'completed',
        completed_date: now,
        webhook_sent_at: now 
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job status and webhook_sent_at:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update job status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log('Successfully updated job status to completed and webhook_sent_at for job:', jobId);
    }

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