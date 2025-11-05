import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('Received appointment webhook:', JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.appointment?.id || !payload.appointment?.title || 
        !payload.appointment?.startTime || !payload.appointment?.endTime) {
      console.error('Missing required fields:', payload);
      return new Response(
        JSON.stringify({ error: 'Missing required fields: appointment.id, title, startTime, and endTime are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { appointment, locationId } = payload;

    // Map assigned user by name if provided
    let assignedUserId = null;
    if (appointment.assignedUserId) {
      // Try to find user by name (assuming assignedUserId contains the user name from external system)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .ilike('name', appointment.assignedUserId)
        .single();

      if (userData && !userError) {
        assignedUserId = userData.id;
        console.log(`Mapped assigned user "${appointment.assignedUserId}" to ID: ${assignedUserId}`);
      } else {
        console.warn(`Could not find user with name: ${appointment.assignedUserId}`);
      }
    }

    // Map multiple users if provided
    const assignedUsers: string[] = [];
    if (appointment.users && Array.isArray(appointment.users)) {
      for (const userName of appointment.users) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .ilike('name', userName)
          .single();

        if (userData && !userError) {
          assignedUsers.push(userData.id);
          console.log(`Mapped user "${userName}" to ID: ${userData.id}`);
        } else {
          console.warn(`Could not find user with name: ${userName}`);
        }
      }
    }

    // Check if appointment already exists
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('external_id', appointment.id)
      .maybeSingle();

    if (existingAppointment) {
      // Update existing appointment
      const { data, error } = await supabase
        .from('appointments')
        .update({
          location_id: locationId,
          address: appointment.address,
          title: appointment.title,
          calendar_id: appointment.calendarId,
          contact_id: appointment.contactId,
          group_id: appointment.groupId,
          appointment_status: appointment.appointmentStatus || 'confirmed',
          assigned_user_id: assignedUserId,
          assigned_users: assignedUsers,
          notes: appointment.notes,
          source: appointment.source,
          start_time: appointment.startTime,
          end_time: appointment.endTime,
          updated_at: new Date().toISOString(),
        })
        .eq('external_id', appointment.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating appointment:', error);
        return new Response(
          JSON.stringify({ error: `Failed to update appointment: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Appointment updated successfully:', data.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Appointment updated successfully',
          id: data.id,
          external_id: appointment.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Insert new appointment
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          external_id: appointment.id,
          location_id: locationId,
          address: appointment.address,
          title: appointment.title,
          calendar_id: appointment.calendarId,
          contact_id: appointment.contactId,
          group_id: appointment.groupId,
          appointment_status: appointment.appointmentStatus || 'confirmed',
          assigned_user_id: assignedUserId,
          assigned_users: assignedUsers,
          notes: appointment.notes,
          source: appointment.source,
          start_time: appointment.startTime,
          end_time: appointment.endTime,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating appointment:', error);
        return new Response(
          JSON.stringify({ error: `Failed to create appointment: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Appointment created successfully:', data.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Appointment created successfully',
          id: data.id,
          external_id: appointment.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});