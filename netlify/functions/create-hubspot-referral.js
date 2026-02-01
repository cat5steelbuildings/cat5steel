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
        company: `REFERRAL from ${data.referrer_name}`
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

    // Create a note on the prospect contact with all referral details
    const noteBody = `REFERRAL LEAD - $500 Program

Referred by: ${data.referrer_name}
Referrer Phone: ${data.referrer_phone}
Referrer Email: ${data.referrer_email}

Building Type: ${data.building_type || 'Not specified'}
${data.additional_notes ? `Additional Notes: ${data.additional_notes}` : ''}

⚠️ IMPORTANT: This is a referral. Pay $250 on deposit, $250 on ground break.
Contact referrer when deal closes to arrange payment.`;

    const noteData = {
      properties: {
        hs_timestamp: Date.now(),
        hs_note_body: noteBody,
        hubspot_owner_id: null
      }
    };

    // Add note to prospect
    const noteResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`
      },
      body: JSON.stringify(noteData)
    });

    const noteResult = await noteResponse.json();
    
    // Associate note with contact
    if (noteResponse.ok && noteResult.id) {
      await fetch(`https://api.hubapi.com/crm/v3/objects/notes/${noteResult.id}/associations/contact/${prospectResult.id}/note_to_contact`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_TOKEN}`
        }
      });
    }

    // Optionally create/update the REFERRER contact as well
    // This ensures you have their info in HubSpot for payment tracking
    const referrerData = {
      properties: {
        firstname: data.referrer_name.split(' ')[0] || data.referrer_name,
        lastname: data.referrer_name.split(' ').slice(1).join(' ') || '',
        email: data.referrer_email,
        phone: data.referrer_phone || '',
        company: `Referral Partner - Referred ${data.prospect_name}`
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
