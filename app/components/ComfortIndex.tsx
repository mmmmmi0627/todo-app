"use client";

interface ForecastItem {
  main: { temp: number; humidity: number };
  wind: { speed: number };
  pop: number;
}

interface Props {
  todayItems: ForecastItem[];
}

function umbrella(pop: number) {
  if (pop >= 0.7) return { value: "必要", icon: "☂️", bg: "bg-blue-500/30", color: "text-blue-100" };
  if (pop >= 0.4) return { value: "折りたたみ", icon: "🌂", bg: "bg-sky-400/30", color: "text-sky-100" };
  return { value: "不要", icon: "☀️", bg: "bg-yellow-400/20", color: "text-yellow-100" };
}

function heatRisk(temp: number, humidity: number) {
  if (temp >= 35 || (temp >= 31 && humidity >= 80))
    return { value: "危険", icon: "🔴", bg: "bg-red-500/30", color: "text-red-200" };
  if (temp >= 31 || (temp >= 28 && humidity >= 75))
    return { value: "厳重警戒", icon: "🟠", bg: "bg-orange-500/30", color: "text-orange-200" };
  if (temp >= 28 || (temp >= 25 && humidity >= 80))
    return { value: "警戒", icon: "🟡", bg: "bg-yellow-400/20", color: "text-yellow-100" };
  if (temp >= 25)
    return { value: "注意", icon: "🟢", bg: "bg-green-400/20", color: "text-green-100" };
  return { value: "安全", icon: "✅", bg: "bg-green-400/20", color: "text-green-100" };
}

function laundry(humidity: number, wind: number, pop: number) {
  if (pop >= 0.5) return { value: "NG", icon: "🚫", bg: "bg-red-500/30", color: "text-red-200" };
  if (humidity >= 80) return { value: "室内干し", icon: "🏠", bg: "bg-gray-400/20", color: "text-gray-200" };
  if (humidity >= 65) return { value: "普通", icon: "👕", bg: "bg-white/10", color: "text-white/80" };
  if (wind >= 3) return { value: "よく乾く", icon: "💨", bg: "bg-sky-400/20", color: "text-sky-100" };
  return { value: "最適", icon: "⭐", bg: "bg-yellow-400/20", color: "text-yellow-100" };
}

export default function ComfortIndex({ todayItems }: Props) {
  if (todayItems.length === 0) return null;

  const maxPop = Math.max(...todayItems.map((i) => i.pop));
  const maxTemp = Math.max(...todayItems.map((i) => i.main.temp));
  const maxHumidity = Math.max(...todayItems.map((i) => i.main.humidity));
  const avgWind = todayItems.reduce((s, i) => s + i.wind.speed, 0) / todayItems.length;

  const indices = [
    { label: "傘指数", ...umbrella(maxPop) },
    { label: "熱中症リスク", ...heatRisk(maxTemp, maxHumidity) },
    { label: "洗濯指数", ...laundry(maxHumidity, avgWind, maxPop) },
  ];

  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-white">
      <p className="text-sm font-semibold mb-3">今日の体感指数</p>
      <div className="grid grid-cols-3 gap-2">
        {indices.map((idx) => (
          <div key={idx.label} className={`${idx.bg} rounded-xl p-3 flex flex-col items-center gap-1.5`}>
            <p className="text-xs opacity-70">{idx.label}</p>
            <span className="text-2xl">{idx.icon}</span>
            <p className={`text-xs font-bold ${idx.color}`}>{idx.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
