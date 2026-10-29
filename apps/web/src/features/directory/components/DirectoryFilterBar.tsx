'use client';

import { DEPARTMENTS, DIRECTORY_ROLES } from '@ruet-chottor/shared';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import type { DirectoryFilters } from '../hooks/use-directory';

const DEPARTMENT_OPTIONS = [...new Map(DEPARTMENTS.map((d) => [d.short, d])).values()].sort(
  (a, b) => a.name.localeCompare(b.name),
);
// Newest first; RUET's oldest living alumni were admitted in the 1960s.
const SERIES_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 1 - 1964 + 1 },
  (_, i) => new Date().getFullYear() + 1 - i,
);

const selectClass =
  'h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

type FilterBarProps = {
  /** What the user typed, before the search delay. */
  search: string;
  filters: DirectoryFilters;
  onSearch: (value: string) => void;
  onFilter: (key: Exclude<keyof DirectoryFilters, 'q'>, value: string) => void;
  onClear: () => void;
};

export function DirectoryFilterBar({
  search,
  filters,
  onSearch,
  onFilter,
  onClear,
}: FilterBarProps) {
  const active =
    search !== '' || filters.department !== '' || filters.series !== '' || filters.role !== '';

  return (
    <div role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-1">
          <Label htmlFor="directory-q">{help.fields.search}</Label>
          <InfoTip text={help.tips.search} label={`About ${help.fields.search.toLowerCase()}`} />
        </div>
        <Input
          id="directory-q"
          type="search"
          className="h-10"
          placeholder={help.fields.searchPlaceholder}
          maxLength={80}
          autoComplete="off"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor="directory-department">{help.fields.department}</Label>
          <InfoTip
            text={help.tips.department}
            label={`About ${help.fields.department.toLowerCase()}`}
          />
        </div>
        <select
          id="directory-department"
          className={selectClass}
          value={filters.department}
          onChange={(event) => onFilter('department', event.target.value)}
        >
          <option value="">{help.fields.any}</option>
          {DEPARTMENT_OPTIONS.map((department) => (
            <option key={department.short} value={department.short}>
              {department.name} ({department.short})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor="directory-series">{help.fields.series}</Label>
          <InfoTip text={help.tips.series} label={`About ${help.fields.series.toLowerCase()}`} />
        </div>
        <select
          id="directory-series"
          className={selectClass}
          value={filters.series}
          onChange={(event) => onFilter('series', event.target.value)}
        >
          <option value="">{help.fields.any}</option>
          {SERIES_OPTIONS.map((series) => (
            <option key={series} value={series}>
              {series}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="directory-role">{help.fields.role}</Label>
        <select
          id="directory-role"
          className={selectClass}
          value={filters.role}
          onChange={(event) => onFilter('role', event.target.value)}
        >
          <option value="">{help.fields.any}</option>
          {DIRECTORY_ROLES.map((role) => (
            <option key={role} value={role}>
              {help.roles[role]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <Button variant="ghost" className="h-10" disabled={!active} onClick={onClear}>
          {help.fields.clear}
        </Button>
      </div>
    </div>
  );
}
