import { describe, it, expect } from "vitest";
import { PostgreSqlDriver } from "../src/drivers/postgresql.driver.js";
import type { Condition } from "../src/core/expressions.js";

describe("PostgreSqlDriver", () => {
  const driver = new PostgreSqlDriver("fake");

  it("creates insert query", () => {
    expect(driver.getInsertQuery("users", ["name", "age"])).toBe(
      'INSERT INTO "users" ("name", "age") VALUES ($1, $2) RETURNING id',
    );
  });

  it("creates upsert query", () => {
    expect(driver.getUpsertQuery("users", ["id", "name", "age"], ["id"])).toBe(
      'INSERT INTO "users" ("id", "name", "age") VALUES ($1, $2, $3) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "age" = EXCLUDED."age" RETURNING *',
    );
  });

  it("creates select query", () => {
    expect(driver.getSelectQuery("users", ["id", "name"])).toBe(
      'SELECT "id", "name" FROM "users"',
    );
  });

  it("creates select query with equal where", () => {
    const conditions: Condition = {
      id: { op: "equal", value: 1 },
    };

    expect(driver.getSelectQuery("users", ["id", "name"], conditions)).toBe(
      'SELECT "id", "name" FROM "users" WHERE "id" = $1',
    );
  });

  it("creates select query with greater than where", () => {
    const conditions: Condition = {
      age: { op: "greaterThan", value: 18 },
    };

    expect(driver.getSelectQuery("users", ["id"], conditions)).toBe(
      'SELECT "id" FROM "users" WHERE "age" > $1',
    );
  });

  it("creates select query with less than where", () => {
    const conditions: Condition = {
      age: { op: "lessThan", value: 60 },
    };

    expect(driver.getSelectQuery("users", ["id"], conditions)).toBe(
      'SELECT "id" FROM "users" WHERE "age" < $1',
    );
  });

  it("creates select query with like where", () => {
    const conditions: Condition = {
      name: { op: "contains", value: "john" },
    };

    expect(driver.getSelectQuery("users", ["id"], conditions)).toBe(
      'SELECT "id" FROM "users" WHERE "name" LIKE $1',
    );
  });

  it("creates select query with multiple conditions", () => {
    const conditions: Condition = {
      age: { op: "greaterThan", value: 18 },
      id: { op: "equal", value: 10 },
    };

    expect(driver.getSelectQuery("users", ["*"], conditions)).toBe(
      'SELECT * FROM "users" WHERE "age" > $1 AND "id" = $2',
    );
  });

  it("creates select query with limit offset", () => {
    expect(driver.getSelectQuery("users", ["*"], {}, 5, 10)).toBe(
      'SELECT * FROM "users" LIMIT 5 OFFSET 10',
    );
  });

  it("creates update query", () => {
    const conditions: Condition = {
      id: { op: "equal", value: 1 },
    };

    expect(driver.getUpdateQuery("users", ["name", "age"], conditions)).toBe(
      'UPDATE "users" SET "name" = $1, "age" = $2 WHERE "id" = $3',
    );
  });

  it("creates delete query", () => {
    const conditions: Condition = {
      id: { op: "equal", value: 1 },
    };

    expect(driver.getDeleteQuery("users", conditions)).toContain(
      'DELETE FROM "users"',
    );
  });

  it("creates count query", () => {
    expect(driver.getCountQuery("users")).toBe(
      'SELECT COUNT(*) AS count FROM "users"',
    );
  });

  it("creates count query with where", () => {
    const conditions: Condition = {
      age: { op: "greaterThan", value: 18 },
    };

    expect(driver.getCountQuery("users", conditions)).toBe(
      'SELECT COUNT(*) AS count FROM "users" WHERE "age" > $1',
    );
  });

  it("escapes name", () => {
    expect(driver.escapeName("users")).toBe('"users"');
  });

  it("escapes quotes in name", () => {
    expect(driver.escapeName('user"name')).toBe('"user""name"');
  });
});
