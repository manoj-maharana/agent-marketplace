from app.framework.skills import BaseSkill, skill_registry

_LENGTH_TO_M = {"m": 1, "km": 1000, "mi": 1609.34, "ft": 0.3048, "cm": 0.01, "in": 0.0254}
_WEIGHT_TO_KG = {"kg": 1, "g": 0.001, "lb": 0.453592, "oz": 0.0283495}


def _temperature(value: float, frm: str, to: str) -> float:
    if frm == "c" and to == "f":
        return value * 9 / 5 + 32
    if frm == "f" and to == "c":
        return (value - 32) * 5 / 9
    if frm == "c" and to == "k":
        return value + 273.15
    if frm == "k" and to == "c":
        return value - 273.15
    raise ValueError(f"Unsupported temperature conversion: {frm} -> {to}")


class UnitConverterSkill(BaseSkill):
    key = "unit_converter"
    name = "Unit Converter"
    description = "Convert a numeric value between common length, weight, or temperature units."
    parameters = {
        "type": "object",
        "properties": {
            "value": {"type": "number", "description": "The numeric value to convert."},
            "from_unit": {"type": "string", "description": "Source unit, e.g. km, mi, kg, lb, c, f."},
            "to_unit": {"type": "string", "description": "Target unit, e.g. km, mi, kg, lb, c, f."},
        },
        "required": ["value", "from_unit", "to_unit"],
    }

    async def run(self, value: float, from_unit: str, to_unit: str) -> dict:
        frm, to = from_unit.strip().lower(), to_unit.strip().lower()
        try:
            if frm in _LENGTH_TO_M and to in _LENGTH_TO_M:
                result = value * _LENGTH_TO_M[frm] / _LENGTH_TO_M[to]
            elif frm in _WEIGHT_TO_KG and to in _WEIGHT_TO_KG:
                result = value * _WEIGHT_TO_KG[frm] / _WEIGHT_TO_KG[to]
            elif frm in {"c", "f", "k"} and to in {"c", "f", "k"}:
                result = _temperature(value, frm, to)
            else:
                return {"error": f"Unsupported or mismatched units: {from_unit} -> {to_unit}"}
            return {
                "value": value,
                "from_unit": from_unit,
                "to_unit": to_unit,
                "result": round(result, 4),
            }
        except Exception as exc:  # noqa: BLE001
            return {"error": str(exc)}


skill_registry.register(UnitConverterSkill())
