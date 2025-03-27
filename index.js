const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/audio', express.static(path.join(__dirname, 'audio')));

const PORT = process.env.PORT || 3000;
const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel (ElevenLabs)

// ➤ Einstiegspunkt: Begrüßung über ElevenLabs → lokal speichern
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

    const fileName = `intro-${Date.now()}.mp3`;
    const filePath = path.join(__dirname, 'audio', fileName);
    fs.writeFileSync(filePath, elevenResp.data);

    const fileUrl = `${process.env.BASE_URL}/audio/${fileName}`;
    console.log('🎧 Intro lokal gespeichert:', fileUrl);

    const response = create({
      Response: {
        Play: fileUrl,
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
    res.send('<Response><Say>Fehler beim Starten des Gesprächs.</Say></Response>');
  }
});

// ➤ Antwort mit statischem Text → lokal speichern
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

    const fileName = `reply-${Date.now()}.mp3`;
    const filePath = path.join(__dirname, 'audio', fileName);
    fs.writeFileSync(filePath, elevenResp.data);

    const fileUrl = `${process.env.BASE_URL}/audio/${fileName}`;
    console.log('🗣️ Antwort lokal gespeichert:', fileUrl);

    const twiml = create({
      Response: {
        Play: fileUrl
      }
    }).end({ prettyPrint: true });

    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('❌ Fehler beim Antwortteil:', err.message);
    res.send('<Response><Say>Technischer Fehler bei der Antwort.</Say></Response>');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Lisa Voicebot läuft auf http://localhost:${PORT}`);
});
