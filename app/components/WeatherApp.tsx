"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { searchJapanCities } from "./japanCities";
import ComfortIndex from "./ComfortIndex";

interface FavoriteCity {
  name: string;
  nameEn: string;
  lat: number;
  lon: number;
}

const FAVORITES_KEY = "weather_favorites";

interface GeoSuggestion {
  name: string;
  nameEn: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

interface WeatherMain {
  temp: number;
  feels_like: number;
  humidity: number;
  temp_min: number;
  temp_max: number;
}

interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface CurrentWeather {
  name: string;
  sys: { country: string };
  coord: { lat: number; lon: number };
  main: WeatherMain;
  weather: WeatherCondition[];
  wind: { speed: number };
  clouds: { all: number };
}

interface ForecastItem {
  dt: number;
  dt_txt: string;
  main: WeatherMain;
  weather: WeatherCondition[];
  wind: { speed: number };
  pop: number;
  rain?: { "3h": number };
}

interface ForecastData {
  list: ForecastItem[];
  city: { name: string; country: string };
}

interface ApiResponse {
  current: CurrentWeather;
  forecast: ForecastData;
  resolvedCityName?: string;
  error?: string;
}

interface DayGroup {
  dateStr: string;
  label: string;
  dayLabel: string;
  items: ForecastItem[];
  tempMin: number;
  tempMax: number;
  icon: string;
  description: string;
  maxPop: number;
}

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function toJSTDateStr(dt: number): string {
  const d = new Date(dt * 1000);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): { label: string; dayLabel: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = DAY_NAMES[date.getDay()];
  const todayStr = toJSTDateStr(Math.floor(Date.now() / 1000));
  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
  let label = `${m}/${d}`;
  if (dateStr === todayStr) label = "今日";
  else if (dateStr === tomorrowStr) label = "明日";
  return { label, dayLabel: `(${day})` };
}

function groupForecastByDay(forecastList: ForecastItem[]): DayGroup[] {
  const map = new Map<string, ForecastItem[]>();
  for (const item of forecastList) {
    const key = toJSTDateStr(item.dt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const groups: DayGroup[] = [];
  for (const [dateStr, items] of map.entries()) {
    const temps = items.map((i) => i.main.temp);
    const { label, dayLabel } = formatDateLabel(dateStr);
    const noonItem = items.find((i) => {
      const h = new Date(i.dt * 1000).getUTCHours() + 9;
      return h >= 11 && h <= 14;
    }) ?? items[Math.floor(items.length / 2)];
    groups.push({
      dateStr,
      label,
      dayLabel,
      items,
      tempMin: Math.min(...temps),
      tempMax: Math.max(...temps),
      icon: noonItem.weather[0].icon,
      description: noonItem.weather[0].description,
      maxPop: Math.max(...items.map((i) => i.pop)),
    });
  }
  return groups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

function WeatherIcon({ icon, size = 48 }: { icon: string; size?: number }) {
  return (
    <img
      src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
      alt=""
      width={size}
      height={size}
      className="drop-shadow"
    />
  );
}

function WindDirection({ deg }: { deg?: number }) {
  if (deg === undefined) return null;
  const dirs = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  return <span>{dirs[Math.round(deg / 45) % 8]}</span>;
}

export default function WeatherApp() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteCity[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  const saveFavorites = (list: FavoriteCity[]) => {
    setFavorites(list);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  };

  const toggleFavorite = () => {
    if (!data) return;
    const city: FavoriteCity = {
      name: data.resolvedCityName ?? data.current.name,
      nameEn: data.current.name,
      lat: data.current.coord.lat,
      lon: data.current.coord.lon,
    };
    const exists = favorites.some((f) => f.name === city.name);
    saveFavorites(exists ? favorites.filter((f) => f.name !== city.name) : [...favorites, city].slice(0, 5));
  };

  const isFavorited = data
    ? favorites.some((f) => f.name === (data.resolvedCityName ?? data.current.name))
    : false;

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Japanese characters: try static list first (instant), then OWM geocoding
    const isJapanese = /[぀-ヿ㐀-䶿一-鿿]/.test(trimmed);
    if (isJapanese) {
      const local = searchJapanCities(trimmed).map((c) => ({
        name: c.ja,
        nameEn: c.nameEn,
        lat: c.lat,
        lon: c.lon,
        country: "JP",
        state: c.region,
      }));
      setSuggestions(local);
      setShowSuggestions(local.length > 0);
      return;
    }

    // English/romaji: use OWM Geocoding API
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        const list: GeoSuggestion[] = await res.json();
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchWeather = useCallback(async (params: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    setError(null);
    setSelectedDate(null);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/weather?${params}`);
      const json: ApiResponse = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "データの取得に失敗しました");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("ネットワークエラーが発生しました");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("都市名を入力してください（例：Tokyo、大阪、Osaka）");
      return;
    }
    fetchWeather(`city=${encodeURIComponent(trimmed)}`);
  };

  const handleSelectSuggestion = (s: GeoSuggestion) => {
    setQuery(s.name !== s.nameEn ? `${s.name} (${s.nameEn})` : s.name);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchWeather(`lat=${s.lat}&lon=${s.lon}`);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("このブラウザでは現在地の取得に対応していません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWeather(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      },
      () => setError("現在地の取得に失敗しました")
    );
  };

  const dayGroups = data ? groupForecastByDay(data.forecast.list) : [];
  const selectedGroup = selectedDate ? dayGroups.find((g) => g.dateStr === selectedDate) : null;
  const cityDisplay =
    data &&
    `${data.resolvedCityName ?? data.current.name}${data.current.sys.country ? `, ${data.current.sys.country}` : ""}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center text-white mb-6">
          <h1 className="text-3xl font-bold drop-shadow">天気予報</h1>
        </div>

        {/* Search */}
        <div className="relative z-10 bg-white/20 backdrop-blur-sm rounded-2xl p-4 space-y-3 overflow-visible">
          <div ref={searchRef} className="relative">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setError(null); }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="都市名・市区町村を入力（例：東京都、大阪府、Osaka）"
                className="flex-1 bg-white/80 rounded-xl px-4 py-2.5 text-gray-800 placeholder-gray-500 outline-none focus:bg-white transition text-sm"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-white text-blue-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition disabled:opacity-50 text-sm whitespace-nowrap"
              >
                検索
              </button>
            </form>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition flex items-center gap-3 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-lg">📍</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {s.name}
                          {s.name !== s.nameEn && (
                            <span className="text-gray-500 font-normal ml-1">({s.nameEn})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {[s.state, s.country].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={handleCurrentLocation}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white/30 hover:bg-white/40 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            現在地を使用
          </button>

          {/* Favorites chips */}
          {favorites.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {favorites.map((fav) => (
                <button
                  key={fav.name}
                  onClick={() => {
                    setQuery(fav.name);
                    fetchWeather(`lat=${fav.lat}&lon=${fav.lon}`);
                  }}
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-full transition"
                >
                  ⭐ {fav.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center text-white py-8">
            <div className="inline-block w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="mt-2 text-sm">取得中...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/80 text-white rounded-2xl p-4 text-center text-sm">
            {error}
          </div>
        )}

        {/* Current Weather */}
        {data && !loading && (
          <>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium opacity-80">{cityDisplay}</p>
                <button
                  onClick={toggleFavorite}
                  title={isFavorited ? "お気に入りから削除" : "お気に入りに追加"}
                  className="text-xl leading-none hover:scale-125 transition-transform"
                >
                  {isFavorited ? "⭐" : "☆"}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-end gap-1">
                    <span className="text-6xl font-thin">{Math.round(data.current.main.temp)}</span>
                    <span className="text-2xl mb-2">°C</span>
                  </div>
                  <p className="text-lg capitalize">{data.current.weather[0].description}</p>
                  <p className="text-sm opacity-80">体感 {Math.round(data.current.main.feels_like)}°C</p>
                </div>
                <WeatherIcon icon={data.current.weather[0].icon} size={80} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
                <StatItem icon="💧" label="湿度" value={`${data.current.main.humidity}%`} />
                <StatItem
                  icon="🌬️"
                  label="風速"
                  value={`${data.current.wind.speed}m/s`}
                />
                <StatItem icon="☁️" label="雲量" value={`${data.current.clouds.all}%`} />
              </div>
            </div>

            {/* Comfort Index */}
            <ComfortIndex todayItems={dayGroups[0]?.items ?? []} />

            {/* Weekly Forecast Calendar */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-white text-sm font-semibold mb-3">週間予報</p>
              <div className="grid grid-cols-5 gap-2">
                {dayGroups.slice(0, 5).map((group) => (
                  <button
                    key={group.dateStr}
                    onClick={() =>
                      setSelectedDate(selectedDate === group.dateStr ? null : group.dateStr)
                    }
                    className={`flex flex-col items-center p-2 rounded-xl transition text-white ${
                      selectedDate === group.dateStr
                        ? "bg-white/40 ring-2 ring-white"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <span className="text-xs font-bold">{group.label}</span>
                    <span className="text-xs opacity-70">{group.dayLabel}</span>
                    <WeatherIcon icon={group.icon} size={36} />
                    <span className="text-xs font-semibold">{Math.round(group.tempMax)}°</span>
                    <span className="text-xs opacity-70">{Math.round(group.tempMin)}°</span>
                    {group.maxPop > 0 && (
                      <span className="text-xs text-blue-200 mt-0.5">
                        {Math.round(group.maxPop * 100)}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Day Detail */}
            {selectedGroup && (
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-white">
                <p className="text-sm font-semibold mb-3">
                  {selectedGroup.label}{selectedGroup.dayLabel} の予報
                </p>
                <div className="space-y-2">
                  {selectedGroup.items.map((item) => {
                    const d = new Date(item.dt * 1000);
                    const jstH = (d.getUTCHours() + 9) % 24;
                    const timeStr = `${String(jstH).padStart(2, "0")}:00`;
                    return (
                      <div key={item.dt} className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
                        <span className="text-sm font-mono w-12">{timeStr}</span>
                        <WeatherIcon icon={item.weather[0].icon} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.weather[0].description}</p>
                          <p className="text-xs opacity-70">
                            💧{item.main.humidity}% 🌬️{item.wind.speed}m/s
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{Math.round(item.main.temp)}°C</p>
                          {item.pop > 0 && (
                            <p className="text-xs text-blue-200">
                              {Math.round(item.pop * 100)}%
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Initial State */}
        {!data && !loading && !error && (
          <div className="text-center text-white/70 py-12">
            <p className="text-4xl mb-3">🌤️</p>
            <p className="text-sm">都市名を入力するか、現在地を使用してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg">{icon}</span>
      <span className="text-xs opacity-70">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
