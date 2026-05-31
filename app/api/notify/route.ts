import { NextRequest } from "next/server";

const OWM_BASE = "https://api.openweathermap.org/data/2.5";

function toJSTHour(dt: number) {
  return (new Date(dt * 1000).getUTCHours() + 9) % 24;
}

function toJSTDateStr(dt: number) {
  const jst = new Date(dt * 1000 + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineUserId = process.env.LINE_USER_ID;
  const city = process.env.NOTIFY_CITY ?? "Tokyo";

  if (!apiKey || !lineToken || !lineUserId) {
    return Response.json({ error: "Missing env vars" }, { status: 500 });
  }

  const res = await fetch(
    `${OWM_BASE}/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ja`,
    { cache: "no-store" }
  );
  if (!res.ok) return Response.json({ error: "Forecast fetch failed" }, { status: 500 });
  const forecast = await res.json();

  const todayStr = toJSTDateStr(Math.floor(Date.now() / 1000));

  const todayItems = (forecast.list as Array<{
    dt: number;
    pop: number;
    weather: { description: string }[];
    main: { temp: number };
  }>).filter((item) => {
    const h = toJSTHour(item.dt);
    return toJSTDateStr(item.dt) === todayStr && h >= 6 && h <= 21;
  });

  const maxPop = todayItems.length > 0 ? Math.max(...todayItems.map((i) => i.pop)) : 0;

  if (maxPop < 0.5) {
    return Response.json({ sent: false, reason: "No significant rain today", maxPop });
  }

  const rainySlots = todayItems
    .filter((i) => i.pop >= 0.4)
    .map((i) => `• ${String(toJSTHour(i.dt)).padStart(2, "0")}:00  ${i.weather[0].description}（${Math.round(i.pop * 100)}%）`)
    .join("\n");

  const allTemps = (forecast.list as Array<{ dt: number; main: { temp: number } }>)
    .filter((i) => toJSTDateStr(i.dt) === todayStr)
    .map((i) => i.main.temp);
  const tempMax = allTemps.length > 0 ? Math.round(Math.max(...allTemps)) : "—";
  const tempMin = allTemps.length > 0 ? Math.round(Math.min(...allTemps)) : "—";

  const cityName: string = forecast.city?.name ?? city;
  const message = [
    `☔ 【雨の予報】${cityName}`,
    "",
    "本日の天気予報をお知らせします。",
    "",
    "🌧 雨が予想される時間帯：",
    rainySlots || "• 雨の可能性あり",
    "",
    `🌡 最高 ${tempMax}°C  /  最低 ${tempMin}°C`,
    "",
    "☂️ 傘をお忘れなく！",
  ].join("\n");

  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lineToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!lineRes.ok) {
    const err = await lineRes.text();
    return Response.json({ error: "LINE send failed", detail: err }, { status: 500 });
  }

  return Response.json({ sent: true, city: cityName, maxPop });
}
