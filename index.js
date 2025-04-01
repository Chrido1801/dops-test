
// Deepgram Debug-Version

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}
app.use('/audio', express.static(audioDir));

const PORT = process.env.PORT || 3000;
const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

app.post('/voice', async (req, res) => {
  try {
    const introText = 'Grüß Gott, hier ist Lisa von DOPS conTRUSTing aus Kindberg. Ich hätte nur eine kurze Frage zur regionalen Werbung.';

    const elevenResp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: introText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.9 }
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
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, elevenResp.data);

    const fileUrl = `${process.env.BASE_URL}/audio/${fileName}`;
    console.log('🎧 Intro gespeichert:', fileUrl);

    const response = create({
      Response: {
        Play: fileUrl,
        Record: {
          '@timeout': 5,
          '@maxLength': 10,
          '@action': `${process.env.BASE_URL}/process-recording`,
          '@playBeep': false
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

app.post('/process-recording', async (req, res) => {
  try {
    const recordingUrl = req.body.RecordingUrl + '.mp3';
    const tempFile = path.join(audioDir, `user-${Date.now()}.mp3`);

    console.log('🎙️ Lade Aufnahme herunter:', recordingUrl);
    const audioResp = await axios.get(recordingUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempFile, audioResp.data);
    const audioData = fs.readFileSync(tempFile);

    console.log('🧪 Sende an Deepgram...');

    try {
      const deepgramResp = await axios.post(
        'https://api.deepgram.com/v1/listen',
        audioData,
        {
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/mp3'
          }
        }
      );

      const userText = deepgramResp.data.results.channels[0].alternatives[0].transcript;
      console.log('🗣️ Deepgram Transkript:', userText);
    } catch (deepgramErr) {
      if (deepgramErr.response) {
        console.error('❌ Deepgram Fehler:', deepgramErr.response.status);
        console.error('🧾 Deepgram Antwort:', JSON.stringify(deepgramErr.response.data, null, 2));
      } else {
        console.error('❌ Deepgram Verbindung fehlgeschlagen:', deepgramErr.message);
      }
      res.send('<Response><Say>Deepgram-Fehler aufgetreten.</Say></Response>');
      return;
    }

    res.send('<Response><Say>Test abgeschlossen. Deepgram-Debug aktiv.</Say></Response>');
  } catch (err) {
    console.error('❌ Fehler bei Debug-Test:', err.message);
    res.send('<Response><Say>Technischer Fehler im Debug-Modus.</Say></Response>');
  }
});

app.listen(PORT, () => {
  console.log(`🛠️ Lisa Voicebot (Deepgram Debug) läuft auf Port ${PORT}`);
});
