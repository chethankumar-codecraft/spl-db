export type OPERATOR =
  | "equal"
  | "notEqual"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"
  | "startsWith"
  | "endsWith"
  | "contains";

export interface Expression {
  op: OPERATOR;
  value: unknown;
}

export type Condition = Record<string, Expression>;
