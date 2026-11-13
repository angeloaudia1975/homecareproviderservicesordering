# When this site deploys

Every production deploy spends 15 Netlify team credits. `netlify.toml` `[build] ignore` lets a push deploy only when it
changes `public/`, `netlify/` or `netlify.toml` — the only things the live site serves or runs. Pushes that change only
SQL (`supabase/`), tests, scripts, content sources / overrides or notes are skipped (shown as "Canceled", no credits).

A new top-level folder the site needs must be added to the list in `netlify.toml`, or its changes will not go live.
A notes-only push made while another deploy is still building may still deploy (Netlify compares with the last cached
build); push it after the running deploy finishes.
