import { EyeOffIcon, FlagIcon, ShieldCheckIcon } from 'lucide-react';
import { help } from '../help';

const SAFETY_ICONS = [EyeOffIcon, FlagIcon, ShieldCheckIcon];

/** For visitors: how joining works, then what keeps the square safe. */
export function VisitorGuide() {
  const { join, safety } = help;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section aria-labelledby="home-join" className="grid content-start gap-4">
        <h2 id="home-join" className="text-lg font-semibold">
          {join.title}
        </h2>
        <ol className="grid gap-4">
          {join.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="home-safety"
        className="grid content-start gap-4 rounded-xl border border-dashed p-4 sm:p-5"
      >
        <h2 id="home-safety" className="text-lg font-semibold">
          {safety.title}
        </h2>
        <ul className="grid gap-4">
          {safety.items.map((item, index) => {
            const Icon = SAFETY_ICONS[index]!;
            return (
              <li key={item.title} className="flex gap-3">
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-green" />
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
