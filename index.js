const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const { create } = require('xmlbuilder2');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;
const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel (ElevenLabs)

// ➤ Einstiegspunkt: Begrüßung über ElevenLabs
app.post('/voice', async (req, res) => {
  try {
    const introText = 'Grüß Gott, hier ist Lisa von DOPS conTRUSTing aus Kindberg. Ich hätte nur eine kurze Frage zur regionalen Werbung.';

    const elevenResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: introText,
        model_id: 'eleven_multilingual_v2',
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

    const fileUpload = await axios.post('https://file.io/?expires=1d', elevenResp.data, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    const introUrl = "https://drive.google.com/file/d/1-dnzfW9f1oD-WCZRUtf_XzeiW7qabRXj/view?usp=sharing";

    if (!introUrl) {
      throw new Error('Kein gültiger Link von file.io erhalten');
    }

    console.log("🎧 Intro MP3 Link:", introUrl);

    const response = create({
      Response: {
        Play: introUrl,
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

  } catch (err) {
    console.error('❌ Fehler beim Intro:', err.message);
    res.send('<Response><Say>Es gab ein Problem mit dem Sprachmodul.</Say></Response>');
  }
});

// ➤ GPT + ElevenLabs Antwort
app.post('/process-recording', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl + '.mp3';

  try {
    const userText = "Ich interessiere mich für Werbung in der Region.";

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

    const elevenResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: gptReply,
        model_id: 'eleven_multilingual_v2',
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

    const fileUpload = await axios.post('https://file.io/?expires=1d', elevenResp.data, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    const audioUrl = fileUpload.data.success && fileUpload.data.link ? fileUpload.data.link : null;

    if (!audioUrl) {
      throw new Error('Kein gültiger Link von file.io erhalten (Antwort)');
    }

    console.log("🗣️ Antwort MP3 Link:", audioUrl);

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

// ➤ Server starten
app.listen(PORT, () => {
  console.log(`✅ Lisa Voicebot läuft auf Port ${PORT}`);
});
