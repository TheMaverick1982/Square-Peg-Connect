import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Square Peg Connect <notifications@updates.squarepegpizzeria.com>";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);

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
    const { name, company, email, phone, eventDate, guestCount, notes, location, orderPreference, heardAboutUs, leadSource } = await req.json();

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not set." }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <h2 style="color: #111;">New Catering Request</h2>
        <p>A new catering lead has been submitted and added to the pipeline in <strong>Requested</strong> status.</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Name:</strong> ${esc(name)}</p>
          <p style="margin: 5px 0;"><strong>Company/Event:</strong> ${esc(company || "N/A")}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${esc(email)}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${esc(phone)}</p>
          <p style="margin: 5px 0;"><strong>Event Date:</strong> ${esc(eventDate)}</p>
          <p style="margin: 5px 0;"><strong>Guests:</strong> ${esc(guestCount)}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${esc(location || "N/A")}</p>
          <p style="margin: 5px 0;"><strong>Order Preference:</strong> ${esc(orderPreference || "Not specified")}</p>
          ${heardAboutUs ? `<p style="margin: 5px 0;"><strong>Heard About Us:</strong> ${esc(heardAboutUs)}</p>` : ""}
          <p style="margin: 5px 0;"><strong>Source:</strong> ${esc(leadSource || "Unknown")}</p>
          ${notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong><br/>${esc(notes).replace(/\n/g, "<br/>")}</p>` : ""}
        </div>
        <p>Please review and follow up via the Square Peg Connect Dashboard.</p>
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
        to: ["catering@squarepegpizzeria.com", "hr@squarepegpizzeria.com"],
        subject: "New Catering Request: " + (company || name),
        html: html,
      }),
    });

    const resData = await res.json();
    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
