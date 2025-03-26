const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const { create } = require('xmlbuilder2');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;

// ➤ Einstiegspunkt für Twilio bei Anruf
app.post('/voice', async (req, res) => {
  const response = create({
    Response: {
      Say: {
        '@voice': 'alice',
        '#': 'Grüß Gott, hier ist Lisa von DOPS. Sagen Sie mir bitte kurz, was Sie über Werbung in Ihrer Region denken?'
      },
      Record: {
        '@timeout': 5,
        '@maxLength': 10,
        '@action': `${process.env.BASE_URL}/process-recording`,
        '@playBeep': true
      }
    }
  }).end({ prettyPrint: true });

  res.type('text/xml');
  res.send(response);
});

// ➤ Verarbeitung der Antwort mit GPT + ElevenLabs
app.post('/process-recording', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl + '.mp3';

  try {
    // GPT-Testfrage (optional: hier später Whisper-Transkript einsetzen)
    const userText = "Ich interessiere mich für Werbung in der Region.";

    // GPT generiert Antwort
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

    // ElevenLabs: Text zu Sprache
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

    // MP3 bei file.io hochladen
    const fileUpload = await axios.post('https://file.io/?expires=1d', elevenResp.data, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    const audioUrl = fileUpload.data.link;
    console.log("🟢 MP3-Link für Twilio:", audioUrl);

    // Twilio <Play> MP3
    const twiml = create({
      Response: {
        Play: audioUrl
      }
    }).end({ prettyPrint: true });

    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('❌ Fehler im Bot:', err.message);
    res.send('<Response><Say>Entschuldigung, es gab ein technisches Problem.</Say></Response>');
  }
});

// ➤ Starte Server
app.listen(PORT, () => {
  console.log(`✅ Lisa Voicebot läuft auf Port ${PORT}`);
});
