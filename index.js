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

    console.log('✅ Gespeichert:', tempFile);

    const audioData = fs.readFileSync(tempFile);

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
    console.log('🗣️ Nutzer sagte (Deepgram):', userText);

    const gptResp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Du bist Lisa, eine sympathische Verkaufsberaterin aus der Steiermark. Antworte charmant und zielgerichtet auf regionale Werbefragen und leite sanft zu einem Vor-Ort-Termin über.'
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
    console.log('🔊 Antwort MP3:', audioUrl);

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
  console.log(`✅ Lisa Voicebot (Deepgram Edition) läuft auf Port ${PORT}`);
});
