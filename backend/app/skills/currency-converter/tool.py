import httpx

from app.framework.skills import BaseSkill, skill_registry


class CurrencyConverterSkill(BaseSkill):
    key = "currency_converter"
    name = "Currency Converter"
    description = "Convert an amount from one currency to another using current exchange rates."
    parameters = {
        "type": "object",
        "properties": {
            "amount": {"type": "number", "description": "The amount to convert."},
            "from_currency": {"type": "string", "description": "3-letter source currency code, e.g. USD."},
            "to_currency": {"type": "string", "description": "3-letter target currency code, e.g. EUR."},
        },
        "required": ["amount", "from_currency", "to_currency"],
    }

    async def run(self, amount: float, from_currency: str, to_currency: str) -> dict:
        frm, to = from_currency.strip().upper(), to_currency.strip().upper()
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://api.frankfurter.app/latest",
                    params={"amount": amount, "from": frm, "to": to},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Currency lookup failed: {exc}"}

        rates = data.get("rates") or {}
        if to not in rates:
            return {"error": f"Unsupported currency pair: {frm} -> {to}"}

        converted = rates[to]
        return {
            "amount": amount,
            "from_currency": frm,
            "to_currency": to,
            "converted": converted,
            "rate": round(converted / amount, 6) if amount else None,
        }


skill_registry.register(CurrencyConverterSkill())
