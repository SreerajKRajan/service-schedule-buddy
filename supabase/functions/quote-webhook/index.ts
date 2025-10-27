import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      customer_name, 
      customer_phone, 
      customer_email, 
      customer_address, 
      quoted_by, 
      jobs_selected, 
      first_time,
      scheduled_date,
      ghl_contact_id,
      appointment_id
    } = await req.json();

    console.log('Received webhook data:', {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      quoted_by,
      jobs_selected,
      first_time,
      scheduled_date,
      ghl_contact_id,
      appointment_id
    });

    // Validate required fields
    if (!customer_name || !jobs_selected) {
      return new Response(
        JSON.stringify({ error: 'customer_name and jobs_selected are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if appointment_id exists in jobs table (already converted)
    if (appointment_id) {
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id')
        .eq('appointment_id', appointment_id)
        .single();

      if (existingJob) {
        console.log(`Job already exists for appointment_id ${appointment_id}, skipping`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Job already exists for this appointment',
            job_id: existingJob.id 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Look up user ID if quoted_by is provided as a name
    let quoted_by_id = null;
    if (quoted_by && typeof quoted_by === 'string') {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', quoted_by)
        .eq('active', true)
        .single();
      
      if (!userError && userData) {
        quoted_by_id = userData.id;
        console.log(`Found user ID ${quoted_by_id} for name "${quoted_by}"`);
      } else {
        console.log(`No active user found with name "${quoted_by}"`);
      }
    }

    // Check if appointment_id exists in accepted_quotes (update instead of insert)
    if (appointment_id) {
      const { data: existingQuote } = await supabase
        .from('accepted_quotes')
        .select('id, status')
        .eq('appointment_id', appointment_id)
        .single();

      if (existingQuote) {
        console.log(`Updating existing quote ${existingQuote.id} for appointment_id ${appointment_id}`);
        
        const { data, error } = await supabase
          .from('accepted_quotes')
          .update({
            customer_name,
            customer_phone,
            customer_email,
            customer_address,
            quoted_by: quoted_by_id,
            jobs_selected,
            first_time: first_time || false,
            scheduled_date,
            ghl_contact_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingQuote.id)
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update quote data' }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log('Successfully updated accepted quote:', data);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Quote updated successfully',
            id: data.id 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Insert new quote into accepted_quotes table
    const { data, error } = await supabase
      .from('accepted_quotes')
      .insert({
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        quoted_by: quoted_by_id,
        jobs_selected,
        first_time: first_time || false,
        scheduled_date,
        ghl_contact_id,
        appointment_id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save quote data' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Successfully saved new accepted quote:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Quote received successfully',
        id: data.id 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in quote-webhook function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});