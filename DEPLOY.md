# DEPLOY — GitHub Pages runbook

Status: **Phase 1 (unlisted)** — private repo, GitHub Pro, Pages live but
shared only with a small circle. Flip to public only after the original
author's permission (Phase 2).

Facts to respect (GitHub policy, checked 2026):

- On GitHub Free, a Pages repository must be public. Pages from a private
  repository requires GitHub Pro.
- Pages sites are ALWAYS publicly reachable — even when built from a private
  repository. Phase 1 is therefore "unlisted", not access-controlled.
- Repository visibility is a one-toggle switch; a Pages site has no visibility
  switch of its own.

---

## Phase 1 — private repository + unlisted site

### Prerequisites

- New GitHub account: 2FA enabled, recovery codes saved, SSH key added.
- GitHub Pro active on that account (≈ $4/month).
- Local clone of this repository on branch `master`.

### Files involved

- `.github/workflows/pages.yml` — lint + unit tests + build, then deploy to Pages.
- `public/robots.txt` — crawler opt-out (Phase 1 only).
- `index.html` — `noindex,nofollow` meta tag (Phase 1 only).

### Steps

1. Pre-push audit (local):
   - `git status` clean; `.gitignore` covers `artifacts/`, `dist/`,
     `node_modules/`, `.openchamber/`, test outputs.
   - No file larger than 50 MB outside `node_modules/`/`.git/`
     (`src/data/rounds.json` is 12 MB — fine).
   - No secrets: the deploy needs none (static app, zero network at runtime).
   - `../kelimator-nostalji/` stays outside the repository.
2. Create a PRIVATE repository. The repository name appears in the site URL —
   choose deliberately.
   ```
   git remote add origin git@github.com:<user>/<repo>.git
   git push -u origin master
   ```
3. Repository → Settings → Pages → Source = **GitHub Actions**.
4. Run the workflow once (push, or Actions → *pages* → Run workflow). The site
   appears at `https://<user>.github.io/<repo>/` (first publish can take up to
   ~10 minutes).
5. Verify the site: boot intro plays; play a round; find a word; win screen;
   open DevTools → Network and confirm **zero external requests**; test on a
   phone.
6. Unlisted-phase discipline: share the URL only directly with invited people;
   do not link it anywhere public; re-check robots/noindex after changes.

### Unlisted-phase limitations (accepted trade-off)

- Anyone with the link can open the site. `robots.txt` and the `noindex` meta
  only ask crawlers not to index; they are not security.
- GitHub Pages logs visitor IP addresses (GitHub Privacy Statement).

---

## Phase 2 — after the owner's permission (the flip)

1. Sanitize history first if desired — evidence files contain local hostnames
   and paths. Use `git filter-repo` + force-push, or accept them.
2. Settings → General → Danger Zone → Change visibility → **Public**.
3. Cancel Pro if no longer needed (Pages from a public repository works on
   Free). Flip the repository first, cancel second.
4. Remove the Phase 1 obscurity: delete `public/robots.txt` and the `noindex`
   meta tag in `index.html`, commit, let the workflow redeploy.
5. Add credit: a `NOTICE` file (original game © Levent Güneş; permission date)
   and a README "About" section linking kelimator.com.
6. Share the URL; optionally rename the repository (the Pages URL follows the
   name; old links may stop working).

---

## Rollback / takedown

If permission is denied or anything goes wrong:

1. Settings → Pages → Source = **None** (the site stops serving).
2. Settings → General → Danger Zone → Change visibility → **Private**.
3. Stop sharing the URL. A local clone plus the account recovery codes remain
   the fallback if the account is ever lost.

---

## Notes

- Cost: Pro ≈ $4/month during Phase 1; $0 after Phase 2 if Pro is cancelled.
- Pages limits: 1 GB site size, ~100 GB/month bandwidth (this project: ~6 MB).
- GitHub Actions: no secrets required; ~2 minutes per deploy; the Playwright
  e2e suites stay local (browser download + a 200 s timeout scenario).
- The default branch is `master`; if it is renamed to `main`, update
  `.github/workflows/pages.yml` accordingly.
- Deployment uses an Actions artifact, so Jekyll is not involved and no
  `.nojekyll` file is needed. Vite `base: './'` already supports serving from
  `/<repo>/`.
