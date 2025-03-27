const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// 💡 Ordner audio sicherstellen
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}
app.use('/audio', express.static(audioDir));

const PORT = process.env.PORT || 3000;
const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel (ElevenLabs)

// ➤ Einstieg: Intro über ElevenLabs
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
    const filePath = path.join(audioDir, fileName);
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

// ➤ Verarbeite echte Audioaufnahme mit Whisper → GPT → ElevenLabs
app.post('/process-recording', async (req, res) => {
  try {
    const recordingUrl = req.body.RecordingUrl + '.mp3';
    const tempFile = path.join(audioDir, `user-${Date.now()}.mp3`);

    // 🧲 Lade Audio herunter
    const audioResp = await axios.get(recordingUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempFile, audioResp.data);

    // 🔎 Whisper Speech-to-Text
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile));
    formData.append('model', 'whisper-1');

    const whisperResp = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    const userText = whisperResp.data.text;
    console.log('🗣️ Nutzer sagte:', userText);

    // 🤖 GPT-Antwort generieren
    const gptResp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Du bist Lisa, eine sympathische Verkaufsberaterin für regionale Bildschirmwerbung aus der Steiermark. Sprich locker, charmant, aber fokussiert auf einen Vor-Ort-Termin.'
        },
        {
          role: 'user',
          content: userText
        }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const gptReply = gptResp.data.choices[0].message.content;
    console.log('🤖 GPT antwortet:', gptReply);

    // 🔊 Antwort über ElevenLabs erzeugen
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

    const replyFile = `reply-${Date.now()}.mp3`;
    const replyPath = path.join(audioDir, replyFile);
    fs.writeFileSync(replyPath, elevenResp.data);

    const audioUrl = `${process.env.BASE_URL}/audio/${replyFile}`;

    const twiml = create({
      Response: {
        Play: audioUrl
      }
    }).end({ prettyPrint: true });

    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('❌ Fehler bei Sprachantwort:', err.message);
    res.send('<Response><Say>Technischer Fehler bei der Antwort.</Say></Response>');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Lisa Voicebot mit Whisper läuft auf http://localhost:${PORT}`);
});
