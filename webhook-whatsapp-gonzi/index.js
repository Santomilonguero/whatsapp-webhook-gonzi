/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, PORT } = process.env;

app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));

  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const contact = req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

  if (message) {
    const business_phone_number_id =
      req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    const contactName =
      message?.name || contact?.profile?.name || "Sin nombre";

    const fromNumber = message.from;

    const messageType = message.type;
    const messageText =
      messageType === "text"
        ? message.text.body
        : messageType === "button"
        ? message.button.text
        : "";

    // Palabras clave válidas
    const keywords = {
      es: ["ACEPTAR", "RECHAZAR"],
      en: ["ACCEPT", "DECLINE"],
    };

    // Detectar idioma general
    let responseLanguage = /[a-zA-Z]/.test(messageText) ? "en" : "es";
    if (keywords.es.includes(messageText.toUpperCase())) responseLanguage = "es";
    if (keywords.en.includes(messageText.toUpperCase())) responseLanguage = "en";

    // Mensajes de error automáticos
    const greeting = responseLanguage === "es" ? "¡Hola! 😊" : "Hi! 😊";
    const invalidReply =
      responseLanguage === "es"
        ? `${greeting} Este número solo admite respuestas mediante botones. Si quieres continuar la conversación, pulsa aquí: https://wa.me/34611417836`
        : `${greeting} This number only accepts replies via buttons. To continue the conversation, click here: https://wa.me/34611417836`;

    // ¿Es una respuesta válida?
    const isValid =
      messageType === "button" ||
      keywords.es.includes(messageText.toUpperCase()) ||
      keywords.en.includes(messageText.toUpperCase());

    if (!isValid) {
      // No se reenvía a Make. Solo se responde y se termina.
      try {
        console.log("Mensaje inválido. Enviando aviso automático...");
        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
          headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          },
          data: {
            messaging_product: "whatsapp",
            to: fromNumber,
            text: { body: invalidReply },
            context: { message_id: message.id },
          },
        });
      } catch (error) {
        console.error("Error enviando mensaje de aviso:", error.response?.data || error.message);
      }

      return res.sendStatus(200);
    }

    // Respuesta automática para mensajes válidos
    const autoResponses = {
      es: {
        text: `${greeting} Este es un mensaje automático. No podemos procesar tu mensaje en este número. Por favor, haz clic aquí para continuar la conversación: https://wa.me/34611417836.`,
        button: `${greeting} Gracias por tu respuesta. Ten en cuenta que este es un mensaje automático. Si deseas continuar la conversación, haz clic aquí: https://wa.me/34611417836.`,
      },
      en: {
        text: `${greeting} This is an automatic message. We cannot process your message at this number. Please click here to continue the conversation: https://wa.me/34611417836.`,
        button: `${greeting} Thank you for your response. Please note this is an automatic message. To continue the conversation, click here: https://wa.me/34611417836.`,
      },
    };

    const autoMessage =
      responseLanguage === "es"
        ? messageType === "button"
          ? autoResponses.es.button
          : autoResponses.es.text
        : messageType === "button"
        ? autoResponses.en.button
        : autoResponses.en.text;

    // Enviar datos válidos al webhook de Make
    try {
      console.log("Enviando datos a Make...");
      await axios({
        method: "POST",
        url: "https://hook.eu2.make.com/lqbq30m8ga5igx7sajt0v1pyip6xyp3b",
        data: {
          name: contactName,
          message: messageText,
          from: fromNumber,
          id: message.id,
        },
      });
      console.log("Mensaje enviado al webhook de Make correctamente.");
    } catch (error) {
      console.error("Error enviando datos a Make:", error.response?.data || error.message);
    }

    // Responder al usuario
    try {
      console.log("Enviando respuesta automática al usuario...");
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          to: fromNumber,
          text: { body: autoMessage },
          context: { message_id: message.id },
        },
      });
      console.log("Mensaje de respuesta enviado correctamente.");
    } catch (error) {
      console.error("Error enviando respuesta automática:", error.response?.data || error.message);
    }

    // Marcar como leído
    try {
      console.log("Marcando mensaje como leído...");
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          status: "read",
          message_id: message.id,
        },
      });
      console.log("Mensaje marcado como leído.");
    } catch (error) {
      console.error("Error marcando como leído:", error.response?.data || error.message);
    }
  }

  res.sendStatus(200);
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    res.sendStatus(403);
  }
});

app.get("/", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
