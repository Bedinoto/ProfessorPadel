import { Handler } from "@netlify/functions";
import { google } from "googleapis";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
  `${process.env.APP_URL}/.netlify/functions/google-callback`
);

export const handler: Handler = async (event) => {
  const { code } = event.queryStringParameters || {};

  if (!code) {
    return { statusCode: 400, body: "Missing code" };
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (tokens.refresh_token) {
      await setDoc(doc(db, "settings", "google_calendar"), {
        refresh_token: tokens.refresh_token,
        admin_email: "uillian.bedinoto@gmail.com",
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                document.write('Autenticação concluída! Você pode fechar esta janela.');
              }
            </script>
          </body>
        </html>
      `
    };
  } catch (error: any) {
    return { statusCode: 500, body: error.message };
  }
};
