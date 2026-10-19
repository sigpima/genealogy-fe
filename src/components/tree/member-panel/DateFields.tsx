import { maxDayFor } from '@/lib/tree/dates';
import { parseBoundedInt } from '@/lib/tree/profile';
import { fieldClass } from './styles';

type DateFieldsProps = {
  label: string;
  year: string;
  month: string;
  day: string;
  isLunar: boolean;
  leapMonth: boolean;
  onChange: (patch: { month?: string; day?: string; isLunar?: boolean; leapMonth?: boolean }) => void;
};

/** Month/day (the year is the field above) plus the calendar: a lunar date is what a giỗ is kept by. */
export function DateFields({ label, year, month, day, isLunar, leapMonth, onChange }: DateFieldsProps) {
  const monthValue = parseBoundedInt(month, 1, 12);
  const yearValue = parseBoundedInt(year, 1, 9999);
  const maxDay = maxDayFor(monthValue ?? null, isLunar, yearValue ?? null);
  return (
    <fieldset className="rounded-lg border-default border p-3">
      <legend className="px-1 text-xs text-muted">{label}</legend>
      <div className="flex gap-x-2">
        <label className="block flex-1">
          <span className="text-xs text-muted">Tháng</span>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => onChange({ month: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block flex-1">
          <span className="text-xs text-muted">Ngày</span>
          <input
            type="number"
            min={1}
            max={maxDay}
            value={day}
            onChange={(e) => onChange({ day: e.target.value })}
            className={fieldClass}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-default">
        <label className="flex min-h-11 items-center gap-x-2">
          <input type="checkbox" checked={isLunar} onChange={(e) => onChange({ isLunar: e.target.checked })} />
          Âm lịch
        </label>
        {isLunar && month.trim() !== '' && (
          <label className="flex min-h-11 items-center gap-x-2">
            <input type="checkbox" checked={leapMonth} onChange={(e) => onChange({ leapMonth: e.target.checked })} />
            Tháng nhuận
          </label>
        )}
      </div>
    </fieldset>
  );
}
