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
    const { formData, locationName, leadSource } = await req.json();
    const source = leadSource || formData?.leadSource || "Unknown";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not set." }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <h2 style="color: #111;">New Tuesday Fundraiser Request</h2>
        <p>A new fundraiser request has been submitted for <strong>${esc(locationName)}</strong> and added to the pipeline in <strong>Requested</strong> status.</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Organization:</strong> ${esc(formData.organization)}</p>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${esc(formData.name)}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${esc(formData.email)}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${esc(formData.phone)}</p>
          <p style="margin: 5px 0;"><strong>Event Date:</strong> ${esc(formatDate(formData.eventDate))}</p>
          <p style="margin: 5px 0;"><strong>Source:</strong> ${esc(source)}</p>
          ${formData.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong><br/>${esc(formData.notes).replace(/\n/g, "<br/>")}</p>` : ""}
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
        subject: "New Fundraiser Request: " + formData.organization,
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
