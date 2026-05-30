import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text, dueDate, isOverdue, notifyLabel } = await req.json();

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  if (!token || !userId) {
    return NextResponse.json({ error: "LINE not configured" }, { status: 503 });
  }

  const d = new Date(dueDate);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const message = isOverdue
    ? `⚠️ 期限超過\n\nタスク: ${text}\n期日: ${dateStr}`
    : `⏰ 期限${notifyLabel ?? ""}のお知らせ\n\nタスク: ${text}\n期日: ${dateStr}`;

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
