import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Clean raw JSON dict strings like {'name': '产品设计', 'level': 3} to just the name value.
 */
export function cleanJsonString(text: string) {
  if (!text) return text;
  return text.replace(/\{['"]name['"]:\s*['"]([^'"]+)['"][^}]*\}/g, '$1');
}
