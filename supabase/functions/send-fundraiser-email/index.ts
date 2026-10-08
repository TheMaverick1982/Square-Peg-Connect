// Supabase Edge Function: send-fundraiser-email
// Triggered by "Email Non Profit" in Square Peg Connect (Fundraisers pipeline).
// Uses existing secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional), SUPABASE_URL (built in).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);

function buildHtml({ order, location, promoPackUrl }: { order: any; location: any; promoPackUrl: string }) {
  const [y, m, d] = String(order.eventDate).slice(0, 10).split('-').map(Number);
  const dateLong = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const dateShort = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const org = esc(order.organization), town = esc(location.name);
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://connect.squarepegpizzeria.com/square-peg-logo.png" alt="Square Peg Pizzeria" style="max-height: 80px;" />
      <div><a href="https://squarepegpizzeria.com" style="color: #666; text-decoration: none; font-size: 14px;">squarepegpizzeria.com</a></div>
    </div>

    <h2 style="color: #111;">Your Fundraising Tuesday is Confirmed!</h2>
    <p>Hi ${esc(order.name)},</p>
    <p>We are thrilled to partner with <strong>${org}</strong> for a Tuesday Charity Night at Square Peg Pizzeria.</p>

    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #AD1A0D;">Event Details</h3>
      <p style="margin: 5px 0;"><strong>Date:</strong> ${dateLong}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> 4:00 PM – Close</p>
      <p style="margin: 5px 0;"><strong>Location:</strong> Square Peg Pizzeria - ${town}</p>
      <p style="margin: 5px 0;">${esc(location.address || '')}</p>
    </div>

    <h3 style="color: #111; margin-top: 30px;">How It Works &amp; Keys to Success</h3>
    <p>You promote. Your supporters dine in. We handle the rest.</p>
    <ul style="padding-left: 20px; line-height: 1.8;">
      <li><strong>Invite Everyone:</strong> The more supporters you bring, the more you earn! Tell your friends, family, and organization members.</li>
      <li><strong>Dine-In and takeout only. No 3rd Party order systems.</strong></li>
      <li><strong>Mention the Organization:</strong> Your supporters MUST simply tell their server they’re dining in support of your organization.</li>
      <li><strong>Earn 20% Back:</strong> We total all qualifying dine-in and takeout food sales and donate 20% directly to your organization!</li>
    </ul>

    <!-- NEW -->
    <h3 style="color: #111; margin-top: 30px;">One thing that'll make your night bigger</h3>
    <p>The groups that raise the most are the ones whose people saw it more than once. Here's something ready to paste for your website, newsletter or Facebook page:</p>
    <div style="border: 2px dashed #d1d5db; border-radius: 8px; padding: 16px 18px; margin: 12px 0 20px; background: #ffffff;">
      <p style="margin: 0 0 8px; font-weight: bold; font-size: 16px; color: #111;">${org} night at Square Peg Pizzeria — ${dateShort}</p>
      <p style="margin: 0 0 10px;">Join us at Square Peg in ${town} on ${dateShort}. Eat dinner, bring friends, and 20% of what everyone spends on food comes back to us. Dine in or take out — just order directly from Square Peg (delivery apps like DoorDash don't count) and tell your server or whoever takes your order that you're with us.</p>
      <p style="margin: 0;">What to know: <a href="https://squarepegpizzeria.com/fundraiser-night/" style="color: #AD1A0D;">https://squarepegpizzeria.com/fundraiser-night/</a></p>
    </div>
    <!-- /NEW -->

    <h3 style="color: #111; margin-top: 30px;">Promotional Assets</h3>
    <p>Here are some social media assets and a flyer to help promote your event. Please download and make sure you fill in the placeholders. <em>(Note: For the best experience downloading and editing these files, we recommend opening this link on a desktop computer.)</em></p>
    <p>
      <a href="${promoPackUrl}" style="display: inline-block; background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Download Promo Pack (.zip)</a>
    </p>

    <p style="margin-top: 25px;"><strong>Need anything else?</strong><br>
    If you have any questions, please reply to this email or reach out to <a href="mailto:catering@squarepegpizzeria.com">catering@squarepegpizzeria.com</a>.</p>

    <p>We can't wait to host you!</p>

    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p style="margin-bottom: 20px;">
        <strong>Love Square Peg?</strong><br/>
        <a href="https://go.squarepegpizzeria.com/Rewards" style="display: inline-block; background-color: #E21C21; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Join our Loyalty Program!</a>
      </p>
      <div style="text-align: center; margin-top: 20px;">
        <a href="https://www.facebook.com/squarepegpizzeria" target="_blank" style="text-decoration: none; margin: 0 7px;"><img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" width="32" height="32" style="border-radius: 4px;" /></a>
        <a href="https://www.instagram.com/SquarePegPizzeria/" target="_blank" style="text-decoration: none; margin: 0 7px;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="32" height="32" style="border-radius: 4px;" /></a>
      </div>
    </div>
  </div>`;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { order, location } = await req.json();
    if (!order?.email) return json({ error: 'This fundraiser has no email address.' }, 400);
    if (!order?.eventDate) return json({ error: 'This fundraiser has no event date.' }, 400);
    if (!location?.name) return json({ error: 'Missing store location.' }, 400);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'RESEND_API_KEY is not set for Edge Functions.' }, 500);
    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'Square Peg Connect <notifications@updates.squarepegpizzeria.com>';
    const promoPackUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/marketing-assets/fundraisers/fundraiser-promo-pack.zip`;

    const replyTo = [location.email, 'catering@squarepegpizzeria.com', 'hr@squarepegpizzeria.com'].filter(Boolean);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [order.email],
        reply_to: replyTo,
        subject: `Confirmed: Tuesday Charity Night for ${order.organization || 'your organization'}!`,
        html: buildHtml({ order, location, promoPackUrl }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: data?.message || `Resend error ${res.status}` }, 500);
    return json({ success: true, id: data?.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
