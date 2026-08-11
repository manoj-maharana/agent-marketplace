import httpx

from app.framework.skills import BaseSkill, skill_registry

_WEATHER_CODES = {
    0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Heavy rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
}


class WeatherLookupSkill(BaseSkill):
    key = "weather_lookup"
    name = "Weather Lookup"
    description = "Look up current weather and a short forecast for a named place."
    parameters = {
        "type": "object",
        "properties": {
            "place": {"type": "string", "description": "A city or place name, e.g. 'Lisbon'."}
        },
        "required": ["place"],
    }

    async def run(self, place: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                geo_resp = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": place, "count": 1},
                )
                geo_resp.raise_for_status()
                results = geo_resp.json().get("results") or []
                if not results:
                    return {"place": place, "error": f"Could not find a location named '{place}'."}

                loc = results[0]
                forecast_resp = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": loc["latitude"],
                        "longitude": loc["longitude"],
                        "current": "temperature_2m,weather_code",
                        "daily": "temperature_2m_max,temperature_2m_min,weather_code",
                        "forecast_days": 3,
                        "timezone": "auto",
                    },
                )
                forecast_resp.raise_for_status()
                data = forecast_resp.json()
        except Exception as exc:  # noqa: BLE001
            return {"place": place, "error": f"Weather lookup failed: {exc}"}

        current = data.get("current", {})
        daily = data.get("daily", {})

        return {
            "place": f"{loc['name']}, {loc.get('country', '')}".strip(", "),
            "current": {
                "temperature_c": current.get("temperature_2m"),
                "conditions": _WEATHER_CODES.get(current.get("weather_code"), "Unknown"),
            },
            "forecast": [
                {
                    "date": daily.get("time", [None])[i] if i < len(daily.get("time", [])) else None,
                    "high_c": daily.get("temperature_2m_max", [None])[i]
                    if i < len(daily.get("temperature_2m_max", []))
                    else None,
                    "low_c": daily.get("temperature_2m_min", [None])[i]
                    if i < len(daily.get("temperature_2m_min", []))
                    else None,
                    "conditions": _WEATHER_CODES.get(
                        daily.get("weather_code", [None])[i]
                        if i < len(daily.get("weather_code", []))
                        else None,
                        "Unknown",
                    ),
                }
                for i in range(min(3, len(daily.get("time", []))))
            ],
        }


skill_registry.register(WeatherLookupSkill())
