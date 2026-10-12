import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Square Peg Connect <notifications@updates.squarepegpizzeria.com>";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);

// "2026-10-20" -> "Tuesday, October 20, 2026" (no time zone shift)
const formatDate = (v: unknown) => {
  const [y, m, d] = String(v ?? "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(v ?? "");
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload = await req.json();

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not set." }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const order = payload.order || payload || {};
    const loc = payload.location || {};

    const name = order.name || order.contact?.name || 'New Contact';
    const email = order.email || order.contact?.emails?.[0] || 'Not provided';
    const phone = order.phone || order.contact?.phoneNumbers?.[0] || 'Not provided';
    const company = order.company || order.organization || order.contact?.companyName || 'Not specified';
    const locationName = loc.name || order.locationName || order.location || 'Unknown Location';
    const locationEmail = loc.email || order.locationEmail;

    // Parse Dates/Times carefully
    const event_date = order.event_date || order.eventDate || 'Not specified';
    const time_start = order.time_start || order.timeStart || 'Not specified';
    const guest_count = order.guest_count || order.guestCount || '0';
    const heardAboutUs = order.heard_about_us || order.heardAboutUs || '';
    const leadSource = payload.leadSource || order.leadSource || 'Unknown';

    let notes = order.notes || '';
    if (typeof notes === 'object') {
      notes = ''; // Prevent raw JSON dumps from displaying
    }

    const requiresRoom = order.requires_room ? "Yes" : "No";

    // Build the dynamic notification array
    const notificationList = ["hr@squarepegpizzeria.com", "catering@squarepegpizzeria.com"];
    if (locationEmail) {
      notificationList.push(locationEmail);
    }
    const uniqueRecipients = Array.from(new Set(notificationList.filter(Boolean)));

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://connect.squarepegpizzeria.com/square-peg-logo.png" alt="Square Peg Pizzeria" style="max-height: 80px;" />
        </div>

        <h2 style="color: #111;">New Large Reservation Request</h2>
        <p>A new large reservation lead has been submitted for <strong>${esc(locationName)}</strong> and added to the pipeline in <strong>Requested</strong> status.</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Name:</strong> ${esc(name)}</p>
          <p style="margin: 5px 0;"><strong>Organization:</strong> ${esc(company)}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${esc(email)}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${esc(phone)}</p>
          <p style="margin: 5px 0;"><strong>Event Date:</strong> ${esc(formatDate(event_date))}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${esc(time_start)}</p>
          <p style="margin: 5px 0;"><strong>Guests:</strong> ${esc(guest_count)}</p>
          <p style="margin: 5px 0;"><strong>Room Required:</strong> ${requiresRoom}</p>
          ${heardAboutUs ? `<p style="margin: 5px 0;"><strong>Heard About Us:</strong> ${esc(heardAboutUs)}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Source:</strong> ${esc(leadSource)}</p>
        </div>

        ${notes && String(notes).trim() !== '' ? `
        <h4 style="margin-bottom: 5px;">Notes / Details:</h4>
        <p style="background-color: #fff; padding: 10px; border-left: 4px solid #ddd; margin-top: 0; white-space: pre-wrap;">${esc(notes)}</p>
        ` : ''}

        <p style="margin-top: 25px;">Please review and follow up via the Square Peg Connect Dashboard.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: uniqueRecipients,
        subject: "New Large Reservation: " + locationName + " - " + event_date,
        html: html,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(resData));
    }

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
