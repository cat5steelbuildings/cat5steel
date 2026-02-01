exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
    
    // Create contact for the PROSPECT (the person being referred)
    const prospectData = {
      properties: {
        firstname: data.prospect_name.split(' ')[0] || data.prospect_name,
        lastname: data.prospect_name.split(' ').slice(1).join(' ') || '',
        email: data.prospect_email || 'noemail@referral.placeholder',
        phone: data.prospect_phone || '',
        // Use existing custom fields
        building_type: data.building_type || '',
        contact_method: data.prospect_phone && data.prospect_phone.trim() ? 'Phone' : 'Email',
        referral_source: `REFERRAL PROGRAM - $500
        
Referrer: ${data.referrer_name}
Phone: ${data.referrer_phone}
Email: ${data.referrer_email}

⚠️ PAY REFERRER: $250 at deposit + $250 at ground break = $500 total`,
        quote_details: data.additional_notes || 'No additional notes provided'
      }
    };

    // Create the prospect contact in HubSpot
    const prospectResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`
      },
      body: JSON.stringify(prospectData)
    });

    const prospectResult = await prospectResponse.json();

    if (!prospectResponse.ok) {
      console.error('HubSpot API error (prospect):', prospectResult);
      return {
        statusCode: prospectResponse.status,
        body: JSON.stringify({ error: 'Failed to create prospect contact', details: prospectResult })
      };
    }

    // Create the REFERRER contact for payment tracking
    const referrerData = {
      properties: {
        firstname: data.referrer_name.split(' ')[0] || data.referrer_name,
        lastname: data.referrer_name.split(' ').slice(1).join(' ') || '',
        email: data.referrer_email,
        phone: data.referrer_phone || '',
        contact_method: data.referrer_phone && data.referrer_phone.trim() ? 'Phone' : 'Email',
        quote_details: `Referral Partner - Owes $500 for referring ${data.prospect_name} (${data.prospect_phone})`
      }
    };

    const referrerResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`
      },
      body: JSON.stringify(referrerData)
    });

    const referrerResult = await referrerResponse.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        prospectId: prospectResult.id,
        referrerId: referrerResult.id || 'existing'
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
