'use client';

import { Calendar, Check, ChevronDown, FileText, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentOwner } from '@/features/items/presentation';
import { useSharedWithMe } from '@/features/shares/hooks';
import { cn, getInitials } from '@/lib/utils';
import {
  hasActiveFilter,
  ME_PERSON,
  MODIFIED_KEYS,
  type ModifiedFilter,
  type SearchFilters as Filters,
  sharedPersonOptions,
  TYPE_KEYS,
  type TypeFilter,
} from './filters';

/** Maps each filter option value to its message key under the `search` namespace. */
const TYPE_LABEL_KEYS: Record<TypeFilter, string> = { FOLDER: 'typeFolder', FILE: 'typeFile' };
const MODIFIED_LABEL_KEYS: Record<ModifiedFilter, string> = {
  today: 'modifiedToday',
  '7d': 'modified7d',
  '30d': 'modified30d',
  year: 'modifiedYear',
};

/**
 * The "Тип / Люди / Изменено" filter chips. `onChange` gets the next full filter set; `onReset` (when
 * any filter is active) clears them all at once — callers on the results page point it at
 * `/search` so a reset returns to the default browse-everything view.
 */
export function SearchFilters({
  value,
  onChange,
  onReset,
  className,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  onReset?: () => void;
  className?: string;
}) {
  const t = useTranslations('search');
  // People = "You" + everyone who shared a file/folder with you (built from the cached shared feed).
  const me = useCurrentOwner();
  const { data: shares } = useSharedWithMe();
  const personOptions = sharedPersonOptions(shares ?? [], t('personMe')).map((o) => ({
    key: o.key,
    label: o.label,
    // "You" carries the signed-in user's avatar; each sharer carries their own.
    avatar: { url: o.key === ME_PERSON ? me.avatarUrl : o.avatarUrl, name: o.label },
  }));
  // A person key with no matching option (a since-revoked share, or the feed not loaded yet) must not
  // read as "You" — that would mislabel a filter that actually excludes your own items.
  const activePerson = value.person
    ? (personOptions.find((o) => o.key === value.person)?.label ?? t('personSomeone'))
    : null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <FilterChip
        icon={<FileText className="size-4" />}
        label={t('filterType')}
        activeLabel={value.type ? t(TYPE_LABEL_KEYS[value.type]) : null}
        options={TYPE_KEYS.map((key) => ({ key, label: t(TYPE_LABEL_KEYS[key]) }))}
        selected={value.type}
        onSelect={(next) => onChange({ ...value, type: next as TypeFilter | undefined })}
      />
      <FilterChip
        icon={<Users className="size-4" />}
        label={t('filterPeople')}
        activeLabel={activePerson}
        options={personOptions}
        selected={value.person}
        onSelect={(next) => onChange({ ...value, person: next })}
      />
      <FilterChip
        icon={<Calendar className="size-4" />}
        label={t('filterModified')}
        activeLabel={value.modified ? t(MODIFIED_LABEL_KEYS[value.modified]) : null}
        options={MODIFIED_KEYS.map((key) => ({ key, label: t(MODIFIED_LABEL_KEYS[key]) }))}
        selected={value.modified}
        onSelect={(next) => onChange({ ...value, modified: next as ModifiedFilter | undefined })}
      />
      {/* Clear every filter at once — only shown when at least one is set. */}
      {hasActiveFilter(value) && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-muted-foreground"
          onClick={() => (onReset ? onReset() : onChange({}))}
        >
          <X className="size-4" />
          {t('resetAll')}
        </Button>
      )}
    </div>
  );
}

/** A round avatar for a person option — image if present, initials otherwise. */
function OptionAvatar({ avatar, className }: { avatar: PersonAvatar; className?: string }) {
  return (
    <Avatar className={cn('shrink-0', className)}>
      {avatar.url && <AvatarImage src={avatar.url} alt="" />}
      <AvatarFallback className="text-[9px]">{getInitials(avatar.name || '?')}</AvatarFallback>
    </Avatar>
  );
}

interface PersonAvatar {
  url: string | null;
  name: string;
}

interface Option {
  key: string;
  label: string;
  /** Present for People options — renders an avatar beside the label (and on the active chip). */
  avatar?: PersonAvatar;
}

/** A single filter pill: shows its value when active (highlighted), a dropdown of options, and a reset. */
function FilterChip({
  icon,
  label,
  activeLabel,
  options,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  activeLabel: string | null;
  options: Option[];
  selected: string | undefined;
  onSelect: (next: string | undefined) => void;
}) {
  const t = useTranslations('search');
  const active = activeLabel !== null;
  const selectedOption = options.find((o) => o.key === selected);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'rounded-full',
            active && 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15',
          )}
        >
          {/* When a person is picked, the chip wears their avatar instead of the group icon. */}
          {active && selectedOption?.avatar ? (
            <OptionAvatar avatar={selectedOption.avatar} className="size-4" />
          ) : (
            icon
          )}
          {activeLabel ?? label}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onSelect={() => onSelect(option.key === selected ? undefined : option.key)}
          >
            {option.avatar && <OptionAvatar avatar={option.avatar} className="size-5" />}
            <span className="flex-1 truncate">{option.label}</span>
            {option.key === selected && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelect(undefined)} className="text-muted-foreground">
              {t('reset')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
