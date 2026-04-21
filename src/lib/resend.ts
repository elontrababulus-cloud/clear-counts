import { Resend } from 'resend';

/**
 * Resend client initialization.
 * 
 * To use this, add NEXT_PUBLIC_RESEND_API_KEY to your .env.local file.
 * We use the NEXT_PUBLIC_ prefix so it can be used for client-side forms 
 * (rare) but ideally, this should be used in Server Actions or Route Handlers.
 */
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

export default resend;

/**
 * Helper to send a simple email without full template logic (useful for testing).
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'ClearCounts CRM <onboarding@resend.dev>',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend Error:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Failed to send email:', err);
    throw err;
  }
}
