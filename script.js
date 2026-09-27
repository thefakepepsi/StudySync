// api/chat.js
// Vercel serverless function. Deployed, this becomes: https://your-site.vercel.app/api/chat
//
// IMPORTANT: Set GROQ_API_KEY as an Environment Variable in your Vercel project
// settings (Project -> Settings -> Environment Variables). Never put the key
// in this file or commit it to your repo.

export default async function handler(req, res) {
  // Basic CORS so your GitHub Pages / Vercel front-end can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY. Set it in your hosting provider\'s environment variables.' });
  }

  try {
    const { messages, system } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Body must include a "messages" array.' });
    }

    // Groq's API is OpenAI-compatible: the system prompt goes in the messages array
    // with role "system", followed by the user/assistant turns.
    const groqMessages = [
      { role: 'system', content: system || 'You are a helpful assistant.' },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 600
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: 'Groq API error', detail: errText });
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
