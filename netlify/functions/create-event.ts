import { Handler } from "@netlify/functions";
import { google } from "googleapis";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Configuração do Firebase (carregada do arquivo ou env)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/api/auth/google/callback`
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { summary, description, startDateTime, endDateTime, location } = JSON.parse(event.body || "{}");

    // Buscar refresh_token no Firestore
    const settingsDoc = await getDoc(doc(db, "settings", "google_calendar"));
    
    if (!settingsDoc.exists() || !settingsDoc.data()?.refresh_token) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Google Calendar não está conectado." }) 
      };
    }

    const refreshToken = settingsDoc.data()?.refresh_token;
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const calendarEvent = {
      summary,
      location,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "America/Sao_Paulo",
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: calendarEvent,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, eventId: response.data.id }),
    };
  } catch (error: any) {
    console.error("Calendar Event Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
