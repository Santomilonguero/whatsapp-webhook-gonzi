/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

if (message) {
  const business_phone_number_id =
    req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  const contactName =
    message?.name || contact?.profile?.name || "Sin nombre";

  const fromNumber = message.from;
  const messageText =
    message.type === "text"
      ? message.text.body
      : message.type === "button"
      ? message.button.text
      : "";

  const keywords = {
    es: ["ACEPTAR", "RECHAZAR"],
    en: ["ACCEPT", "DECLINE"],
  };

  let responseLanguage = null;
  if (keywords.es.includes(messageText.toUpperCase())) {
    responseLanguage = "es";
  } else if (keywords.en.includes(messageText.toUpperCase())) {
    responseLanguage = "en";
  } else {
    responseLanguage = /[a-zA-Z]/.test(messageText) ? "en" : "es";
  }

  const greeting = responseLanguage === "es" ? "¡Hola! 😊" : "Hi! 😊";

  const autoResponses = {
    es: {
      text: `${greeting} Este es un mensaje automático. Este chat no admite respuestas escritas. Si deseas continuar la conversación, haz clic aquí: https://wa.me/34611417836.`,
      button: `${greeting} Gracias por tu respuesta. Este chat solo admite respuestas por botones. Si deseas continuar la conversación, haz clic aquí: https://wa.me/34611417836.`,
    },
    en: {
      text: `${greeting} This is an automatic message. This chat does not accept written replies. To continue the conversation, click here: https://wa.me/34611417836.`,
      button: `${greeting} Thank you for your response. This chat only accepts button replies. To continue the conversation, click here: https://wa.me/34611417836.`,
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

  // 🔒 FILTRO: Si no es texto válido ni botón, respondemos y CORTAMOS
  const isButton = message.type === "button";
  const isValidText = keywords.es.includes(messageText.toUpperCase()) || keywords.en.includes(messageText.toUpperCase());

  if (!isButton && !isValidText) {
    try {
      console.log("Mensaje no permitido, se responde sin enviar a Make.");
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
    } catch (error) {
      console.error("Error enviando respuesta automática:", error.response?.data || error.message);
    }
    res.sendStatus(200);
    return; // 🛑 Corta aquí para que NO se envíe a Make
  }

  // ✅ FLUJO NORMAL PARA MENSAJES VÁLIDOS
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
    console.error("Error enviando datos al webhook de Make:", error.response?.data || error.message);
  }

  // Respuesta automática al usuario
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
    console.error("Error enviando respuesta automática al usuario:", error.response?.data || error.message);
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
    console.error("Error marcando mensaje como leído:", error.response?.data || error.message);
  }
}
