import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Job {
  id: string;
  title: string;
  description: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  scheduled_date: string;
  status: string;
  is_recurring: boolean;
  job_type: string;
  price: number;
  estimated_duration: number;
  notes: string;
  first_time: boolean;
  quoted_by: string;
  webhook_sent_at: string | null;
}

const WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/b8qvo7VooP3JD3dIZU42/webhook-trigger/db146d63-70c7-4176-aa0d-54242066c70a';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting job webhook notifications check...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`One hour from now: ${oneHourFromNow.toISOString()}`);

    // Query for jobs that need webhook notifications
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        id, title, description, customer_name, customer_email, 
        customer_phone, customer_address, scheduled_date, status, 
        is_recurring, job_type, price, estimated_duration, notes, 
        first_time, quoted_by, webhook_sent_at
      `)
      .not('scheduled_date', 'is', null)
      .is('webhook_sent_at', null)
      .or(
        `scheduled_date.lt.${oneHourFromNow.toISOString()},scheduled_date.lt.${now.toISOString()}`
      );

    if (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }

    console.log(`Found ${jobs?.length || 0} jobs that need webhook notifications`);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No jobs requiring webhook notifications found',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each job
    for (const job of jobs) {
      try {
        console.log(`Processing job: ${job.id} - ${job.title}`);
        
        // Prepare webhook payload with all job information
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
          notification_type: 'job_reminder',
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
          console.error(`Webhook failed for job ${job.id}:`, webhookResponse.status, webhookResponse.statusText);
          errorCount++;
          continue;
        }

        console.log(`Webhook sent successfully for job ${job.id}`);

        // Update the job to mark webhook as sent
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ webhook_sent_at: now.toISOString() })
          .eq('id', job.id);

        if (updateError) {
          console.error(`Error updating webhook_sent_at for job ${job.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
        }

      } catch (jobError) {
        console.error(`Error processing job ${job.id}:`, jobError);
        errorCount++;
      }
    }

    const result = {
      message: 'Webhook notifications processed',
      total_jobs: jobs.length,
      successful: successCount,
      errors: errorCount,
      processed_at: now.toISOString()
    };

    console.log('Processing complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in job-webhook-notifications function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});