import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Job {
  id: string
  customer_email?: string
  scheduled_date?: string
  customer_name?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Service due webhook triggered')
    
    const { jobId } = await req.json()
    
    if (!jobId) {
      console.error('No jobId provided')
      return new Response('Job ID is required', { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('Error fetching job:', jobError)
      return new Response('Job not found', { status: 404, headers: corsHeaders })
    }

    // Fetch assigned users
    const { data: assignments, error: assignmentError } = await supabase
      .from('job_assignments')
      .select(`
        user_id,
        users (
          name,
          email
        )
      `)
      .eq('job_id', jobId)

    if (assignmentError) {
      console.error('Error fetching assignments:', assignmentError)
    }

    // Format the data for the webhook
    const email = job.customer_email || ''
    
    // Format date and time from scheduled_date
    let date = ''
    let time = ''
    if (job.scheduled_date) {
      const scheduledDate = new Date(job.scheduled_date)
      date = scheduledDate.toISOString().split('T')[0] // YYYY-MM-DD format
      time = scheduledDate.toTimeString().split(' ')[0] // HH:MM:SS format
    }
    
    // Format assigned users
    const assignedUsers = assignments?.map(a => a.users?.name || '').filter(Boolean).join(',') || ''

    // Build the webhook URL with query parameters
    const webhookUrl = new URL('https://services.leadconnectorhq.com/hooks/b8qvo7VooP3JD3dIZU42/webhook-trigger/fb32d2dd-498f-4afa-a70d-7ae1d9ee625b')
    webhookUrl.searchParams.set('email', email)
    webhookUrl.searchParams.set('date', date)
    webhookUrl.searchParams.set('time', time)
    webhookUrl.searchParams.set('assignedusers', assignedUsers)

    console.log('Calling webhook:', webhookUrl.toString())

    // Make the webhook call
    const webhookResponse = await fetch(webhookUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const webhookSuccess = webhookResponse.ok
    console.log('Webhook call result:', webhookSuccess ? 'Success' : 'Failed', webhookResponse.status)

    if (!webhookSuccess) {
      const responseText = await webhookResponse.text()
      console.error('Webhook response error:', responseText)
    }

    return new Response(
      JSON.stringify({ 
        success: webhookSuccess,
        jobId: jobId,
        webhookUrl: webhookUrl.toString()
      }), 
      { 
        status: webhookSuccess ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})