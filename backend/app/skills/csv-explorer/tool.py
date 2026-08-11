import csv
import io

from app.framework.skills import BaseSkill, skill_registry


def _infer_column_stats(values: list[str]) -> dict:
    non_empty = [v for v in values if v.strip()]
    numeric: list[float] = []
    for v in non_empty:
        try:
            numeric.append(float(v))
        except ValueError:
            pass

    if numeric and len(numeric) == len(non_empty):
        return {"type": "number", "min": min(numeric), "max": max(numeric)}

    distinct = sorted(set(non_empty))
    if len(distinct) <= 10:
        return {"type": "text", "distinct_values": distinct}
    return {"type": "text", "distinct_count": len(distinct), "sample": distinct[:5]}


class CsvExplorerSkill(BaseSkill):
    key = "csv_explorer"
    name = "CSV Explorer"
    description = "Describe the columns, row count, and quick stats for a block of CSV text."
    parameters = {
        "type": "object",
        "properties": {
            "csv_text": {"type": "string", "description": "Raw CSV content, including the header row."}
        },
        "required": ["csv_text"],
    }

    async def run(self, csv_text: str) -> dict:
        try:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            rows = list(reader)
        except Exception as exc:  # noqa: BLE001
            return {"error": f"Could not parse CSV: {exc}"}

        if not rows or not reader.fieldnames:
            return {"error": "No rows or header found."}

        columns = {
            name: _infer_column_stats([row.get(name, "") for row in rows]) for name in reader.fieldnames
        }

        return {
            "row_count": len(rows),
            "columns": columns,
            "sample_rows": rows[:3],
        }


skill_registry.register(CsvExplorerSkill())
