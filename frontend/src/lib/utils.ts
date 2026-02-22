import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  parseISO,
  differenceInDays,
  isSameDay,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { DateRange } from '@/types';

// ----- Class Name Utility -----

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ----- Date Formatting Helpers -----

export function formatDateDisplay(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy', { locale: enUS });
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM', { locale: enUS });
}

export function formatDateAPI(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDayHeader(dateStr: string): string {
  const d = parseISO(dateStr);
  const day = format(d, 'EEEEEE', { locale: enUS });
  const num = format(d, 'd');
  return `${day} ${num}`;
}

export function getWeekRange(date: Date): DateRange {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    from: formatDateAPI(start),
    to: formatDateAPI(end),
  };
}

export function getWorkingDays(dateRange: DateRange): string[] {
  const start = parseISO(dateRange.from);
  const end = parseISO(dateRange.to);
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter((day) => !isWeekend(day)).map((day) => formatDateAPI(day));
}

export function getAllDays(dateRange: DateRange): string[] {
  const start = parseISO(dateRange.from);
  const end = parseISO(dateRange.to);
  return eachDayOfInterval({ start, end }).map((day) => formatDateAPI(day));
}

export function shiftDateRange(dateRange: DateRange, days: number): DateRange {
  const start = addDays(parseISO(dateRange.from), days);
  const end = addDays(parseISO(dateRange.to), days);
  return { from: formatDateAPI(start), to: formatDateAPI(end) };
}

export function isToday(dateStr: string): boolean {
  return isSameDay(parseISO(dateStr), new Date());
}

export function daysBetween(start: string, end: string): number {
  return differenceInDays(parseISO(end), parseISO(start));
}

// ----- Number Formatting -----

export function formatQuantity(value: number): string {
  if (value === 0) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function calcProgress(actual: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, (actual / total) * 100);
}
