import db from "../db";

export function assertEntityExists<T>(query: string, values: unknown[], name: string): T {
  const row = db.prepare(query).get(...values) as T | undefined;
  if (!row) throw new Error(`${name} not found`);
  return row;
}

export function canTransitionOrder(current: string, action: "submit" | "approve" | "reject" | "void" | "reverse") {
  const transitions: Record<string, Array<"submit" | "approve" | "reject" | "void" | "reverse">> = {
    draft: ["submit", "void"],
    submitted: ["approve", "reject"],
    rejected: ["submit"],
    approved: ["reverse"],
    voided: []
  };
  return (transitions[current] || []).includes(action);
}

export function actionPermission(
  orderType: "purchase" | "sales",
  action: "submit" | "approve" | "reject" | "void" | "reverse"
) {
  if (action === "submit") return `${orderType}:submit`;
  return `${orderType}:approve`;
}
