// Representative subset of the most common breached passwords (FR-1.5).
// In production this should be backed by the full 10,000-entry list (e.g. SecLists),
// loaded once at startup rather than committed inline.
export const COMMON_PASSWORDS = new Set(
  [
    "123456", "123456789", "12345678", "12345", "1234567", "password",
    "password1", "12345678910", "qwerty", "qwerty123", "111111", "123123",
    "abc123", "1234567890", "1q2w3e4r", "letmein", "welcome", "monkey",
    "dragon", "iloveyou", "admin", "admin123", "football", "baseball",
    "trustno1", "master", "sunshine", "princess", "starwars", "whatever",
    "shadow", "superman", "michael", "jennifer", "jordan23", "hunter2",
    "passw0rd", "qazwsx", "123321", "000000", "1111111", "666666",
    "7777777", "abcd1234", "asdfghjkl", "zxcvbnm", "changeme", "welcome1",
    "pakistan", "islamabad", "karachi123", "lahore123", "pakistan123",
  ].map((p) => p.toLowerCase())
);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
