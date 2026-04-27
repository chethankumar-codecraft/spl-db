import { describe, it, expect } from "vitest";
import { MySqlDriver } from "../src/drivers/mysql.driver.js";
import type { Condition } from "../src/core/expressions.js";

describe("MySqlDriver - conditions", () => {
  const driver = new MySqlDriver("fake");

  it("handles EQUAL condition", () => {
    const conditions: Condition = {
      id: { op: "equal", value: 1 },
    };

    expect(driver.getSelectQuery("users", ["id"], conditions)).toBe(
      "SELECT `id` FROM `users` WHERE `id` = ?",
    );
  });

  it("handles NOT EQUAL condition", () => {
    const conditions: Condition = {
      id: { op: "notEqual", value: 1 },
    };

    expect(driver.getSelectQuery("users", ["id"], conditions)).toBe(
      "SELECT `id` FROM `users` WHERE `id` != ?",
    );
  });

  it("handles GREATER THAN condition", () => {
    const conditions: Condition = {
      age: { op: "greaterThan", value: 18 },
    };

    expect(driver.getSelectQuery("users", ["age"], conditions)).toBe(
      "SELECT `age` FROM `users` WHERE `age` > ?",
    );
  });

  it("handles LESS THAN condition", () => {
    const conditions: Condition = {
      age: { op: "lessThan", value: 60 },
    };

    expect(driver.getSelectQuery("users", ["age"], conditions)).toBe(
      "SELECT `age` FROM `users` WHERE `age` < ?",
    );
  });

  it("handles GREATER OR EQUAL condition", () => {
    const conditions: Condition = {
      age: { op: "greaterThanOrEqual", value: 18 },
    };

    expect(driver.getSelectQuery("users", ["age"], conditions)).toBe(
      "SELECT `age` FROM `users` WHERE `age` >= ?",
    );
  });

  it("handles LESS OR EQUAL condition", () => {
    const conditions: Condition = {
      age: { op: "lessThanOrEqual", value: 60 },
    };

    expect(driver.getSelectQuery("users", ["age"], conditions)).toBe(
      "SELECT `age` FROM `users` WHERE `age` <= ?",
    );
  });

  it("handles MULTIPLE conditions (AND)", () => {
    const conditions: Condition = {
      age: { op: "greaterThan", value: 18 },
      id: { op: "equal", value: 10 },
    };

    expect(driver.getSelectQuery("users", ["*"], conditions)).toBe(
      "SELECT * FROM `users` WHERE `age` > ? AND `id` = ?",
    );
  });
});
