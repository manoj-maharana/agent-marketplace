import colorsys
import hashlib

from app.framework.skills import BaseSkill, skill_registry


def _seed_hue(seed: str) -> float:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return (int(digest[:8], 16) % 360) / 360


class ColorPaletteGeneratorSkill(BaseSkill):
    key = "color_palette_generator"
    name = "Color Palette Generator"
    description = "Generate a harmonious 5-color palette (as hex codes) from a mood or brand description."
    parameters = {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "A mood, brand, or theme description, e.g. 'calm ocean morning'.",
            }
        },
        "required": ["description"],
    }

    async def run(self, description: str) -> dict:
        base_hue = _seed_hue(description.strip().lower())
        offsets = (0, 0.08, -0.08, 0.5, 0.42)
        saturations = (0.55, 0.45, 0.65, 0.35, 0.5)
        lightnesses = (0.5, 0.7, 0.35, 0.85, 0.6)

        palette = []
        for offset, sat, light in zip(offsets, saturations, lightnesses, strict=True):
            hue = (base_hue + offset) % 1.0
            r, g, b = colorsys.hls_to_rgb(hue, light, sat)
            palette.append(f"#{round(r * 255):02x}{round(g * 255):02x}{round(b * 255):02x}")

        return {"description": description, "palette": palette}


skill_registry.register(ColorPaletteGeneratorSkill())
