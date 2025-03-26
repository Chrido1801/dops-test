app.post('/process-recording', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl + '.mp3';

  try {
    // Whisper: Audio zu Text (optional, wenn Spracheingabe)
    // Hier setzen wir testweise einfach einen fixen Text
    const userText = "Ich interessiere mich für Werbung in der Region.";

    // GPT: Antwort generieren
    const gptResp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Du bist Lisa, eine sympathische Verkaufsberaterin aus der Steiermark. Antworte charmant und kurz auf Fragen zur Bildschirmwerbung.'
        },
        {
          role: 'user',
          content: userText
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const gptReply = gptResp.data.choices[0].message.content;

    // ElevenLabs: Text zu Sprache (MP3 generieren)
    const elevenResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        text: gptReply,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.9
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
      }
    );

    // MP3 temporär bei file.io hochladen (für Tests)
    const fileUpload = await axios.post('https://file.io/?expires=1d', elevenResp.data, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    const audioUrl = fileUpload.data.link;

    // Twilio antwortet mit MP3
    const twiml = create({
      Response: {
        Play: audioUrl
      }
    }).end({ prettyPrint: true });

    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('Fehler im Bot:', err.message);
    res.send('<Response><Say>Entschuldigung, es gab ein technisches Problem.</Say></Response>');
  }
});
