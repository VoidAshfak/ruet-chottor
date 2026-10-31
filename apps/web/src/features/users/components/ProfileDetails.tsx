import type { PublicProfile } from '@ruet-chottor/shared';
import { InfoTip } from '@/components/guide/InfoTip';
import { ClassRepBadge } from './ClassRepBadge';
import { help } from '../help';

type ProfileDetailsProps = {
  profile: PublicProfile;
  /** Explain where department and series come from (on your own profile). */
  showTips?: boolean;
};

/** Name, role and the facts every member can see, plus contact details if shared. */
export function ProfileDetails({ profile, showTips = false }: ProfileDetailsProps) {
  const rows: { label: string; value: string; tip?: string }[] = [
    { label: help.fields.roll, value: profile.roll },
    {
      label: help.fields.department,
      value: profile.department
        ? `${profile.department.name} (${profile.department.short})`
        : help.fields.unknownDepartment,
      tip: showTips ? help.tips.department : undefined,
    },
    {
      label: help.fields.series,
      value: profile.series ? String(profile.series) : help.fields.unknownDepartment,
      tip: showTips ? help.tips.series : undefined,
    },
    { label: help.fields.email, value: profile.email ?? help.fields.hidden },
    { label: help.fields.phone, value: profile.phone ?? help.fields.hidden },
  ];

  return (
    <section className="rounded-lg border p-4 sm:p-6">
      <h2 className="text-xl font-semibold break-words">{profile.name}</h2>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">{help.roles[profile.role]}</p>
        {profile.classRep ? <ClassRepBadge badge={profile.classRep} /> : null}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="flex items-center gap-1 text-sm text-muted-foreground">
              {row.label}
              {row.tip ? (
                <InfoTip text={row.tip} label={`About ${row.label.toLowerCase()}`} />
              ) : null}
            </dt>
            <dd className="-mt-2 break-words sm:mt-0">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
