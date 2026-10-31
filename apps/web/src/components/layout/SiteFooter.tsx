import { footerHelp as help } from './help';

/** The about line and tagline, centred. */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t bg-background">
      <div className="mx-auto grid max-w-5xl justify-items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
        <p className="max-w-xl text-balance">{help.about}</p>
        <p className="text-xs">{help.tagline}</p>
      </div>
    </footer>
  );
}
