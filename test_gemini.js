import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function checkQuotaDetail() {
  const prompt = "Hello! Please output only the word 'OK' in JSON format like {\"status\": \"OK\"}";
  try {
    console.log("Sending check request to Gemini API...");
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    
    console.log("Response Status:", response.status);
    const bodyText = await response.text();
    console.log("Response Body (Raw JSON):");
    try {
      const parsed = JSON.parse(bodyText);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(bodyText);
    }
  } catch (e) {
    console.error("Request failed:", e);
  }
}

checkQuotaDetail();
