import { NextRequest } from "next/server";

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  let locationQuery: string;
  let cityName: string | null = null;

  if (lat && lon) {
    locationQuery = `lat=${lat}&lon=${lon}`;
    const geoRes = await fetch(
      `${GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`,
      { cache: "no-store" }
    );
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.length > 0) cityName = geoData[0].local_names?.ja ?? geoData[0].name;
    }
  } else if (city) {
    locationQuery = `q=${encodeURIComponent(city)}`;
  } else {
    return Response.json({ error: "City or coordinates required" }, { status: 400 });
  }

  const commonParams = `&appid=${apiKey}&units=metric&lang=ja`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?${locationQuery}${commonParams}`, { cache: "no-store" }),
    fetch(`${BASE_URL}/forecast?${locationQuery}${commonParams}`, { cache: "no-store" }),
  ]);

  if (!currentRes.ok) {
    const err = await currentRes.json();
    return Response.json({ error: err.message ?? "City not found" }, { status: currentRes.status });
  }

  const [current, forecast] = await Promise.all([currentRes.json(), forecastRes.json()]);

  return Response.json({
    current,
    forecast,
    resolvedCityName: cityName,
  });
}
