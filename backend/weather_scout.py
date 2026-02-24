"""
NEER — Weather Scout Agent
Live weather intelligence for Indian farmers.

Pipeline:
  Step 1: FETCH WEATHER — Open-Meteo API (free, no key needed)
    → Current conditions + 7-day forecast
  Step 2: FARMING ALERTS — rule-based analysis (no API call)
    → Color-coded alerts based on thresholds
  Step 3: AI ADVISORY — Gemini text call
    → Personalized farming advice based on weather + season

Alert Tiers:
  🔴 danger       — frost, heavy rain, extreme heat
  🟡 caution      — rain tomorrow, high humidity, strong wind
  🟢 favorable    — good spray/sowing conditions
  💧 irrigation   — no rain, hot temps
"""

import json
import os
import urllib.request
import urllib.parse
from datetime import datetime, timezone

# ============================================================
# LOAD CROP CALENDAR KB
# ============================================================
_CALENDAR_PATH = os.path.join(os.path.dirname(__file__), "crop_calendar.json")

with open(_CALENDAR_PATH, "r", encoding="utf-8") as f:
    CALENDAR_KB = json.load(f)

CITY_COORDS = CALENDAR_KB["city_coordinates"]
STATE_CITY = CALENDAR_KB["state_default_city"]
SEASONS = CALENDAR_KB["seasons"]
WEATHER_RULES = CALENDAR_KB["weather_farming_rules"]


def _get_coordinates(city: str, state: str = None):
    """Get lat/lon for a city. Falls back to state default."""
    if city and city in CITY_COORDS:
        return CITY_COORDS[city]
    if state and state in STATE_CITY:
        default_city = STATE_CITY[state]
        if default_city in CITY_COORDS:
            return CITY_COORDS[default_city]
    # Fallback to New Delhi
    return CITY_COORDS.get("New Delhi", {"lat": 28.61, "lon": 77.21})


def _get_weather_emoji(code: int) -> str:
    """Map WMO weather code to emoji."""
    if code <= 1:
        return "☀️"
    elif code <= 3:
        return "⛅"
    elif code <= 48:
        return "🌫️"
    elif code <= 55:
        return "🌧️"
    elif code <= 65:
        return "🌧️"
    elif code <= 67:
        return "🌨️"
    elif code <= 75:
        return "❄️"
    elif code <= 77:
        return "🌨️"
    elif code <= 82:
        return "🌧️"
    elif code <= 86:
        return "❄️"
    elif code <= 99:
        return "⛈️"
    return "🌤️"


def _get_weather_label(code: int) -> str:
    """Map WMO weather code to label."""
    labels = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Depositing rime fog",
        51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
        61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        66: "Light freezing rain", 67: "Heavy freezing rain",
        71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
        80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail"
    }
    return labels.get(code, "Partly cloudy")


def _get_current_season():
    """Get current Indian farming season based on month."""
    month = datetime.now().month
    for name, data in SEASONS.items():
        if month in data["months"]:
            return name, data
    return "Rabi", SEASONS["Rabi"]


class WeatherScout:
    """
    Multi-step weather intelligence agent for farmers.
    """

    def __init__(self, text_fn):
        self.text = text_fn

    def get_weather(self, city: str, state: str, lang: str = "English",
                    crop_type: str = None) -> dict:
        """
        Run the full weather intelligence pipeline.
        """
        steps_completed = []
        coords = _get_coordinates(city, state)
        resolved_city = city if city in CITY_COORDS else STATE_CITY.get(state, "New Delhi")

        # ── STEP 1: FETCH WEATHER (Free API) ──
        print(f"[WEATHER SCOUT] Step 1: Fetching weather for {resolved_city} ({coords['lat']}, {coords['lon']})...")

        try:
            weather_data = self._fetch_open_meteo(coords["lat"], coords["lon"])
            steps_completed.append("fetch_weather")
            print(f"[WEATHER SCOUT] → Weather data received. Current: {weather_data['current']['temp']}°C")
        except Exception as e:
            print(f"[WEATHER SCOUT] ✗ API failed: {e}")
            return {
                "status": "error",
                "message": f"Could not fetch weather data: {str(e)}",
                "agent_steps": steps_completed
            }

        # ── STEP 2: FARMING ALERTS (Free — rule-based) ──
        print("[WEATHER SCOUT] Step 2: Analyzing farming alerts...")
        alerts = self._generate_alerts(weather_data, lang)
        steps_completed.append("farming_alerts")
        print(f"[WEATHER SCOUT] → Generated {len(alerts)} alerts")

        # Get current season info
        season_name, season_data = _get_current_season()
        month_str = str(datetime.now().month)
        current_activity = season_data["activities"].get(month_str, "General field maintenance")

        # ── STEP 3: AI ADVISORY (1 Gemini call) ──
        print("[WEATHER SCOUT] Step 3: Generating AI farming advisory...")
        steps_completed.append("ai_advisory")

        advisory = self._generate_advisory(
            weather_data, alerts, season_name, season_data,
            current_activity, resolved_city, state, lang, crop_type
        )

        # Build response
        return {
            "status": "success",
            "agent_steps": steps_completed,
            "city": resolved_city,
            "state": state,
            "current": weather_data["current"],
            "forecast": weather_data["daily"],
            "alerts": alerts,
            "season": {
                "name": season_name,
                "label": season_data["label"],
                "crops": season_data["crops"],
                "current_activity": current_activity
            },
            "advisory": advisory
        }

    def _fetch_open_meteo(self, lat: float, lon: float) -> dict:
        """Fetch weather from Open-Meteo API."""
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max",
            "timezone": "Asia/Kolkata",
            "forecast_days": 7
        }
        url = f"https://api.open-meteo.com/v1/forecast?{urllib.parse.urlencode(params)}"
        
        req = urllib.request.Request(url, headers={"User-Agent": "NEER-FarmerAI/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        # Parse current
        current = {
            "temp": data["current"]["temperature_2m"],
            "feels_like": data["current"]["apparent_temperature"],
            "humidity": data["current"]["relative_humidity_2m"],
            "wind_speed": data["current"]["wind_speed_10m"],
            "wind_dir": data["current"]["wind_direction_10m"],
            "weather_code": data["current"]["weather_code"],
            "weather_emoji": _get_weather_emoji(data["current"]["weather_code"]),
            "weather_label": _get_weather_label(data["current"]["weather_code"])
        }

        # Parse daily forecast
        daily = []
        for i in range(len(data["daily"]["time"])):
            daily.append({
                "date": data["daily"]["time"][i],
                "temp_max": data["daily"]["temperature_2m_max"][i],
                "temp_min": data["daily"]["temperature_2m_min"][i],
                "rain_mm": data["daily"]["precipitation_sum"][i],
                "rain_prob": data["daily"]["precipitation_probability_max"][i],
                "wind_max": data["daily"]["wind_speed_10m_max"][i],
                "uv_index": data["daily"]["uv_index_max"][i],
                "weather_code": data["daily"]["weather_code"][i],
                "weather_emoji": _get_weather_emoji(data["daily"]["weather_code"][i]),
                "weather_label": _get_weather_label(data["daily"]["weather_code"][i])
            })

        return {"current": current, "daily": daily}

    def _generate_alerts(self, weather: dict, lang: str) -> list:
        """Generate color-coded farming alerts based on weather rules."""
        alerts = []
        current = weather["current"]
        daily = weather["daily"]

        # Check tomorrow's forecast if available
        tomorrow = daily[1] if len(daily) > 1 else daily[0]

        # === DANGER ALERTS ===
        # Frost risk
        if tomorrow["temp_min"] <= 2:
            alerts.append({
                "type": "danger",
                "icon": "❄️",
                "title": "Frost Risk" if lang != "Hindi" else "पाला पड़ने का खतरा",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "frost_risk")
            })

        # Extreme heat
        if tomorrow["temp_max"] >= 42:
            alerts.append({
                "type": "danger",
                "icon": "🔥",
                "title": "Extreme Heat" if lang != "Hindi" else "अत्यधिक गर्मी",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "extreme_heat")
            })

        # Heavy rain
        if tomorrow["rain_mm"] >= 30:
            alerts.append({
                "type": "danger",
                "icon": "🌊",
                "title": "Heavy Rainfall" if lang != "Hindi" else "भारी बारिश",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "heavy_rain")
            })

        # === CAUTION ALERTS ===
        # Rain probability
        if tomorrow["rain_prob"] >= 70 and tomorrow["rain_mm"] < 30:
            alerts.append({
                "type": "caution",
                "icon": "🌧️",
                "title": "Rain Likely Tomorrow" if lang != "Hindi" else "कल बारिश की संभावना",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "rain_probability_high")
            })

        # Strong wind
        if tomorrow["wind_max"] >= 25:
            alerts.append({
                "type": "caution",
                "icon": "💨",
                "title": "Strong Winds" if lang != "Hindi" else "तेज हवा",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "strong_wind")
            })

        # High humidity disease risk
        if current["humidity"] >= 85 and tomorrow["temp_min"] >= 20:
            alerts.append({
                "type": "caution",
                "icon": "🦠",
                "title": "Disease Risk — High Humidity" if lang != "Hindi" else "रोग जोखिम — अधिक नमी",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "high_humidity_disease_risk")
            })

        # === IRRIGATION ALERT ===
        # Check next 3 days for no rain
        no_rain_days = sum(1 for d in daily[:3] if d["rain_mm"] < 1)
        if no_rain_days >= 3 and current["temp"] >= 30:
            alerts.append({
                "type": "irrigation",
                "icon": "💧",
                "title": "Irrigation Needed" if lang != "Hindi" else "सिंचाई आवश्यक",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "irrigation_needed")
            })

        # === FAVORABLE ===
        if (tomorrow["rain_prob"] < 20 and tomorrow["wind_max"] < 15 and
                current["humidity"] < 80 and not any(a["type"] == "danger" for a in alerts)):
            alerts.append({
                "type": "favorable",
                "icon": "✅",
                "title": "Good Spray Window" if lang != "Hindi" else "छिड़काव के लिए अनुकूल",
                "message": next((r["advice_en"] if lang != "Hindi" else r["advice_hi"])
                               for r in WEATHER_RULES if r["condition"] == "good_spray_window")
            })

        return alerts

    def _generate_advisory(self, weather: dict, alerts: list,
                           season_name: str, season_data: dict,
                           current_activity: str, city: str, state: str,
                           lang: str, crop_type: str = None) -> str:
        """Generate AI farming advisory."""
        current = weather["current"]
        tomorrow = weather["daily"][1] if len(weather["daily"]) > 1 else weather["daily"][0]

        alert_summary = "\n".join(
            f"  - [{a['type'].upper()}] {a['title']}: {a['message']}" for a in alerts
        ) if alerts else "  No critical alerts."

        crop_line = f"\nFarmer is growing: {crop_type}" if crop_type else ""

        prompt = f"""You are 'NEER Weather Scout', an expert agricultural weather advisor for Indian farmers.

CURRENT CONDITIONS in {city}, {state}:
- Temperature: {current['temp']}°C (feels like {current['feels_like']}°C)
- Humidity: {current['humidity']}%
- Wind: {current['wind_speed']} km/h
- Conditions: {current['weather_label']}
- Season: {season_data['label']}

TOMORROW'S FORECAST:
- High: {tomorrow['temp_max']}°C, Low: {tomorrow['temp_min']}°C
- Rain: {tomorrow['rain_mm']}mm ({tomorrow['rain_prob']}% probability)
- Wind: {tomorrow['wind_max']} km/h
- UV Index: {tomorrow['uv_index']}

ACTIVE ALERTS:
{alert_summary}

SEASONAL ACTIVITY for this month: {current_activity}
{crop_line}

TASK: Write a concise 3-4 line farming advisory for today. Be specific and actionable.
Include:
1. What to do TODAY based on current weather
2. What to PREPARE FOR based on tomorrow's forecast
3. Any seasonal tip relevant to this month

RULES:
- Be concise — maximum 4 lines
- Be specific (mention temperatures, timing)
- Respond ONLY in {lang}
- Do NOT use greetings or sign-offs"""

        try:
            return self.text(prompt)
        except Exception as e:
            print(f"[WEATHER SCOUT] Advisory AI failed: {e}")
            # Fallback
            if lang == "Hindi":
                return f"आज {city} में {current['temp']}°C तापमान है। मौसम {current['weather_label']}। खेती की गतिविधियाँ: {current_activity}"
            return f"Current temperature in {city} is {current['temp']}°C with {current['weather_label']}. Seasonal activity: {current_activity}"
