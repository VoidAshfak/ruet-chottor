import { RuetEntrance } from '@/components/art/RuetEntrance';
import { footerHelp as help } from './help';

/** The RUET entrance gate, then the about line, all centred. */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t bg-background">
      <div className="mx-auto grid max-w-5xl justify-items-center gap-4 px-4 pt-6 pb-8 text-center text-sm text-muted-foreground">
        <RuetEntrance className="h-auto w-full max-w-2xl" />
        <p className="max-w-xl text-balance">{help.about}</p>
        <p className="text-xs">{help.tagline}</p>
      </div>
    </footer>
  );
}
