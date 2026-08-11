import ast
import operator

from app.framework.skills import BaseSkill, skill_registry

_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.operand))
    raise ValueError("Unsupported expression")


class CalculatorSkill(BaseSkill):
    key = "calculator"
    name = "Calculator"
    description = "Evaluate a numeric arithmetic expression, e.g. '(12 + 4) * 3 / 2'."
    parameters = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "A math expression using + - * / % ** and parentheses.",
            }
        },
        "required": ["expression"],
    }

    async def run(self, expression: str) -> dict:
        try:
            tree = ast.parse(expression, mode="eval")
            result = _eval(tree.body)
            return {"expression": expression, "result": result}
        except Exception as exc:  # noqa: BLE001
            return {"expression": expression, "error": f"Could not evaluate: {exc}"}


skill_registry.register(CalculatorSkill())
