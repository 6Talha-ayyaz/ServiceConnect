import bcrypt from "bcryptjs";
import { config } from "../config";
import { isCommonPassword } from "./commonPasswords";

export function validatePasswordStrength(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push("Password must be at least 8 characters long.");
  if (isCommonPassword(password)) {
    problems.push("This password is too common. Please choose something less predictable.");
  }
  return problems;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptCost);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
