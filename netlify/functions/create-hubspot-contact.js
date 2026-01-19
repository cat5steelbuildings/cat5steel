// Updated Jan 19
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Your HubSpot access token (stored as environment variable)
    const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
    
    // Infer contact method if not provided
    const inferredMethod = (data.method && String(data.method).trim())
      ? String(data.method).trim()
      : (data.phone && String(data.phone).replace(/\D/g, '').length >= 7 ? 'call' : 'email');

    // Build an informative quote details field (safe even if you don't add new HubSpot custom properties)
    const priorityLine = data.leadPriority ? `Priority: ${data.leadPriority}` : (data.phone ? 'Priority: HOT - Call ASAP' : 'Priority: WARM - Email Quote');
    const typeLine = data.leadType ? `Type: ${data.leadType}` : (data.phone ? 'Type: Phone Callback Requested' : 'Type: Email Only');
    const combinedQuoteDetails = [priorityLine, typeLine, '', (data.quoteJson || '')].join('\n');

    // Prepare contact data for HubSpot
    const contactData = {
      properties: {
        firstname: data.name.split(' ')[0] || data.name,
        lastname: data.name.split(' ').slice(1).join(' ') || '',
        email: data.email,
        phone: data.phone || '',
        city: data.location,
        // Custom properties
        contact_method: inferredMethod, // "call" or "email"
        building_type: data.buildingType || '',
        building_size: data.buildingSize || '',
        roof_style: data.roofStyle || data.eaveStyle || '',
        cat5_wind_rating: data.cat5Wind || data.windRating || '',
        selected_upgrades: data.upgrades || '',
        quote_details: combinedQuoteDetails
      }
    };

    // Call HubSpot API
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`
      },
      body: JSON.stringify(contactData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('HubSpot API error:', result);
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: 'Failed to create contact in HubSpot',
          details: result
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        contactId: result.id,
        message: 'Contact created in HubSpot'
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
