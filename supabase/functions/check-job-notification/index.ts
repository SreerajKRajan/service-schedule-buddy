import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { jobId } = await req.json();
    
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking notification for job: ${jobId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the specific job
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        id, title, description, customer_name, customer_email, 
        customer_phone, customer_address, scheduled_date, status, 
        is_recurring, job_type, price, estimated_duration, notes, 
        first_time, quoted_by, webhook_sent_at
      `)
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching job:', error);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if job has scheduled date and hasn't been notified yet
    if (!job.scheduled_date || job.webhook_sent_at) {
      return new Response(JSON.stringify({ 
        message: 'Job does not require immediate notification',
        job_id: jobId,
        reason: !job.scheduled_date ? 'No scheduled date' : 'Already notified'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if notification should be sent immediately
    const now = new Date();
    const scheduledDate = new Date(job.scheduled_date);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Scheduled time: ${scheduledDate.toISOString()}`);
    console.log(`One hour from now: ${oneHourFromNow.toISOString()}`);

    // Send notification if scheduled date is in the past or within the next hour
    const shouldSendImmediately = scheduledDate <= oneHourFromNow;

    if (!shouldSendImmediately) {
      return new Response(JSON.stringify({ 
        message: 'Job notification will be sent via cron job',
        job_id: jobId,
        scheduled_date: job.scheduled_date,
        notification_time: new Date(scheduledDate.getTime() - 60 * 60 * 1000).toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending immediate notification for job: ${jobId}`);

    // Prepare webhook payload
    const webhookPayload = {
      job_id: job.id,
      title: job.title,
      description: job.description,
      customer: {
        name: job.customer_name,
        email: job.customer_email,
        phone: job.customer_phone,
        address: job.customer_address
      },
      schedule: {
        scheduled_date: job.scheduled_date,
        is_recurring: job.is_recurring,
        estimated_duration: job.estimated_duration
      },
      details: {
        job_type: job.job_type,
        status: job.status,
        price: job.price,
        first_time: job.first_time,
        notes: job.notes,
        quoted_by: job.quoted_by
      },
      notification_type: 'immediate_job_reminder',
      sent_at: now.toISOString()
    };

    // Send webhook
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error(`Webhook failed for job ${jobId}:`, webhookResponse.status, webhookResponse.statusText);
      return new Response(JSON.stringify({ 
        error: 'Failed to send webhook notification',
        job_id: jobId,
        webhook_status: webhookResponse.status
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Webhook sent successfully for job ${jobId}`);

    // Update the job to mark webhook as sent
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ webhook_sent_at: now.toISOString() })
      .eq('id', jobId);

    if (updateError) {
      console.error(`Error updating webhook_sent_at for job ${jobId}:`, updateError);
      return new Response(JSON.stringify({ 
        warning: 'Webhook sent but failed to update database',
        job_id: jobId,
        error: updateError.message
      }), {
        status: 207,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      message: 'Immediate notification sent successfully',
      job_id: jobId,
      sent_at: now.toISOString(),
      scheduled_date: job.scheduled_date
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-job-notification function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});