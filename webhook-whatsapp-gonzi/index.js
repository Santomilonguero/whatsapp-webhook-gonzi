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
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.name ||
      contact?.profile?.name ||
      "Sin nombre"; // Valor por defecto si no hay nombre

    const fromNumber = message.from;
    const messageText =
      message.type === "text"
        ? message.text.body
        : message.type === "button"
        ? message.button.text
        : "";

    // Palabras clave en español e inglés
    const keywords = {
      es: ["ACEPTAR", "RECHAZAR"],
      en: ["ACCEPT", "DECLINE"],
    };

    // Detectar si el mensaje contiene palabras clave
    let responseLanguage = null;
    if (keywords.es.includes(messageText.toUpperCase())) {
      responseLanguage = "es"; // Español
    } else if (keywords.en.includes(messageText.toUpperCase())) {
      responseLanguage = "en"; // Inglés
    } else {
      // Detectar idioma general para otros mensajes
      responseLanguage = /[a-zA-Z]/.test(messageText) ? "en" : "es";
    }

    // Saludo dinámico SIN incluir el nombre
    const greeting =
      responseLanguage === "es"
        ? "¡Hola! 😊"
        : "Hi! 😊";

    // Respuestas automáticas basadas en idioma
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
        ? message.type === "button"
          ? autoResponses.es.button
          : autoResponses.es.text
        : message.type === "button"
        ? autoResponses.en.button
        : autoResponses.en.text;

    // Enviar datos al webhook de Make
    try {
      console.log("Enviando datos a Make...");
      await axios({
        method: "POST",
        url: "https://hook.eu2.make.com/lqbq30m8ga5igx7sajt0v1pyip6xyp3b",
        data: {
          name: contactName, // Esto sigue enviándose a Make
          message: messageText,
          from: fromNumber,
          id: message.id,
        },
      });
      console.log("Mensaje enviado al webhook de Make correctamente.");
    } catch (error) {
      console.error(
        "Error enviando datos al webhook de Make:",
        error.response?.data || error.message
      );
    }

    // Enviar respuesta automática al usuario
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
      console.error(
        "Error enviando respuesta automática al usuario:",
        error.response?.data || error.message
      );
    }

    // Marcar mensaje como leído
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
      console.error(
        "Error marcando mensaje como leído:",
        error.response?.data || error.message
      );
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
