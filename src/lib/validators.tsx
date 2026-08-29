import { TextMode } from "@/types/common";

export function toTextMode(value?: string): TextMode {
  if (value === 'vertical' || value === 'multi-line' || value === 'horizontal') {
    return value;
  }
  return 'horizontal'; // default
}