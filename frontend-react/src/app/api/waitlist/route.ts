import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  const { email, source } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Email inválido" }, { status: 400 });
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!spreadsheetId || !clientEmail || !privateKey) {
    return NextResponse.json({ message: "Configuración incompleta" }, { status: 500 });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Lista de espera!A:C",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }), email, source ?? ""]],
      },
    });

    return NextResponse.json({ message: "ok" }, { status: 200 });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ message: "Error al guardar" }, { status: 500 });
  }
}
