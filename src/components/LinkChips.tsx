import { taskLink, type LinkRow, type TaskLink } from '@/lib/links';

const chipTone: Record<TaskLink['kind'], string> = {
  jira: 'border-baton/45 text-baton hover:border-baton',
  github: 'border-line text-chalk hover:border-baton hover:text-baton',
  other: 'border-line text-dim hover:border-baton hover:text-baton',
};

/**
 * The little ticket/PR chips beside a task title. Labelling is a display rule,
 * so it happens here rather than in the data layer — pages hand over the stored
 * URLs untouched.
 */
export default function LinkChips({ links }: { links: LinkRow[] }) {
  return links.map(({ url }) => {
    const link = taskLink(url);
    if (!link) return null;
    return (
      <a
        key={link.url}
        href={link.url}
        target="_blank"
        rel="noreferrer"
        title={link.url}
        className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] tracking-tight transition ${chipTone[link.kind]}`}
      >
        {link.label}
      </a>
    );
  });
}
