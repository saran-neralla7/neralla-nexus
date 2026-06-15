/**
 * WhatsApp Meta Cloud API Notification Helper
 */

// Format phone number to E.164 without the leading '+' as required by Meta Cloud API
export function formatPhoneNumberForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  return cleaned;
}

export interface SendWhatsAppTemplateOptions {
  toPhone: string;
  templateName: string;
  parameters: string[]; // Values for template parameters {{1}}, {{2}}, etc.
  languageCode?: string; // Defaults to 'en_US'
}

export async function sendWhatsAppMessage({
  toPhone,
  templateName,
  parameters,
  languageCode = 'en_US',
}: SendWhatsAppTemplateOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const formattedPhone = formatPhoneNumberForWhatsApp(toPhone);

  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format.' };
  }

  // Graceful mock fallback if credentials are missing
  if (!token || !phoneNumberId) {
    console.log('--- [MOCK WHATSAPP DISPATCH] ---');
    console.log(`To: ${formattedPhone} (${toPhone})`);
    console.log(`Template: ${templateName}`);
    console.log(`Language: ${languageCode}`);
    console.log(`Parameters:`, parameters);
    console.log('---------------------------------');
    return { success: true, messageId: `mock-msg-${Date.now()}` };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: [
          {
            type: 'body',
            parameters: parameters.map((param) => ({
              type: 'text',
              text: param,
            })),
          },
        ],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error response:', responseData);
      return { 
        success: false, 
        error: responseData.error?.message || `API error with status ${response.status}` 
      };
    }

    return { 
      success: true, 
      messageId: responseData.messages?.[0]?.id 
    };
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown network error' 
    };
  }
}
