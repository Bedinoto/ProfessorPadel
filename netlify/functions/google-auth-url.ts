import { Handler } from "@netlify/functions";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${(process.env.APP_URL || "").replace(/\/$/, "")}/.netlify/functions/google-callback`
);

export const handler: Handler = async () => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url })
  };
};
