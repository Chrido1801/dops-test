const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
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
    const introText = 'Guten Tag! Mein Name ist Lisa und ich melde mich im Namen von DOPS conTRUSTing aus Kindberg – wir bieten innovative Bildschirmwerbung an stark frequentierten Orten hier bei uns in der Region. Schon ab wenigen Euro im Monat ist Ihr Unternehmen sichtbar – digital, auffällig und lokal. Gerne vereinbaren wir einen Termin, bei dem Ihen unser Eigentümer Christian Doppelhofer alles persönlich zeigt.';

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

// ➤ GPT-generierte Antwort
app.post('/process-recording', async (req, res) => {
  try {
    const userInput = 'Ein Beispielkunde hat Interesse an Werbung.'; // später via Transkript ersetzen

    const gptResp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Du bist Lisa, eine sympathische Verkaufsberaterin für regionale Bildschirmwerbung aus der Steiermark. Sprich locker, direkt und sympathisch.'
        },
        {
          role: 'user',
          content: userInput
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const gptReply = gptResp.data.choices[0].message.content;
    console.log('🤖 GPT sagt:', gptReply);

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

    const fileName = `reply-${Date.now()}.mp3`;
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, elevenResp.data);

    const audioUrl = `${process.env.BASE_URL}/audio/${fileName}`;

    const twiml = create({
      Response: {
        Play: audioUrl
      }
    }).end({ prettyPrint: true });

    res.type('text/xml');
    res.send(twiml);

  } catch (err) {
    console.error('❌ Fehler im GPT-Teil:', err.message);
    res.send('<Response><Say>Es gab ein Problem mit der Antwort.</Say></Response>');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Lisa Voicebot mit GPT läuft auf http://localhost:${PORT}`);
});
