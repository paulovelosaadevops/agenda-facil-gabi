// Web: localStorage do navegador. No servidor (renderização web) não há armazenamento.
export const authStorage = typeof window === "undefined" ? undefined : window.localStorage;
