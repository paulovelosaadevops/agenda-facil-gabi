// No iPhone/Android a sessão fica salva no SQLite do aparelho (localStorage do expo-sqlite).
import "expo-sqlite/localStorage/install";

export const authStorage = globalThis.localStorage;
