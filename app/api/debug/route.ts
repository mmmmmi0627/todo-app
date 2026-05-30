import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_USER_ID: !!process.env.LINE_USER_ID,
    NODE_ENV: process.env.NODE_ENV,
  });
}
