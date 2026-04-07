require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { getResponse } = require('./botLogic');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Handle incoming messages
app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('--- Incoming Webhook ---');
  console.log(JSON.stringify(body, null, 2));

  if (body.object === 'whatsapp_business_account') {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const msgBody = message.text ? message.text.body : '';

      console.log(`Message from ${from}: ${msgBody}`);

      if (msgBody) {
        const responseText = await getResponse(msgBody, from);
        console.log(`Bot Response: ${responseText}`);
        await sendWhatsAppMessage(from, responseText);
      }
    } else {
      console.log('No messages found in request body.');
    }
    res.sendStatus(200);
  } else {
    console.log('Request body object is not whatsapp_business_account.');
    res.sendStatus(404);
  }
});

async function sendWhatsAppMessage(to, text) {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      data: {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text },
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error.response ? error.response.data : error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
