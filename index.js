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

    const filename = `lisa-intro-${Date.now()}.mp3`;
    const uploadResp = await axios.put(
      `https://temp.sh/${filename}`,
      elevenResp.data,
      {
        headers: {
          'Content-Type': 'audio/mpeg'
        }
      }
    );

    const introUrl = uploadResp.config.url;
    console.log("🎧 Intro MP3 von temp.sh:", introUrl);

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

// ➤ Antwort (nur statischer Text für Testzwecke)
app.post('/process-recording', async (req, res) => {
  try {
    const staticReply = 'Das klingt spannend, gerne zeige ich Ihnen das persönlich. Wie wäre es mit einem Termin am Dienstag um 10 Uhr?';

    const elevenResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: staticReply,
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

    const filename = `lisa-reply-${Date.now()}.mp3`;
    const uploadResp = await axios.put(
      `https://temp.sh/${filename}`,
      elevenResp.data,
      {
        headers: {
          'Content-Type': 'audio/mpeg'
        }
      }
    );

    const audioUrl = uploadResp.config.url;
    console.log("🗣️ Antwort MP3 von temp.sh:", audioUrl);

    const twiml = create({
      Response: {
        Play: audioUrl
      }
    }).end({ prettyPrint: true });

    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('❌ Fehler im Antwortteil:', err.message);
    res.send('<Response><Say>Entschuldigung, es gab ein technisches Problem.</Say></Response>');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Lisa Voicebot (statisch) läuft auf Port ${PORT}`);
});
