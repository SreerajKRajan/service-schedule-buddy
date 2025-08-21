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

    // Get assigned employees
    const { data: assignments, error: assignmentsError } = await supabase
      .from('job_assignments')
      .select(`
        users (name)
      `)
      .eq('job_id', jobId);

    const employeesAssigned = assignments?.map(assignment => assignment.users?.name).filter(Boolean) || [];

    // Prepare webhook payload
    const webhookPayload = {
      project_value: job.price || 0,
      project_title: job.title,
      quoted_by_name: quotedByName,
      first_time: job.first_time || false,
      employees_assigned: employeesAssigned
    };

    console.log('Sending webhook payload:', webhookPayload);

    // Send webhook to the specified URL
    const webhookResponse = await fetch('https://bhcobewqjkvptmojaoep.supabase.co/functions/v1/project-webhook', {
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