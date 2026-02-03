import { NextResponse } from "next/server";

export async function GET() {
  const appKey = process.env.YVP_APP_KEY;

  if (!appKey) {
    return NextResponse.json({ error: "Missing YVP_APP_KEY" }, { status: 500 });
  }

  const res = await fetch("https://api.youversion.com/v1/bibles", {
    headers: {
      "X-YVP-App-Key": appKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}