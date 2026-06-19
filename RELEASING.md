# Releasing

conform-ed publishes its public packages (`@conform-ed/contracts`, `qti-react`, `qti-xml`,
`common-cartridge`, `pci-math-entry`) to **two** npm registries:

| Registry                                   | Role                                                                          | How it's published                           |
| ------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------- |
| **npmjs.com**                              | Public, prod-facing. What consumers (incl. emergent's CI/prod) install.       | Manual, by `bun run release`                 |
| **GitHub Packages** (`npm.pkg.github.com`) | Internal: a `dev` channel + a mirror of releases. Requires auth even to read. | Automatic, by the `GitHub Packages` workflow |

The GitHub Packages workflow (`.github/workflows/github-packages.yml`) fires on:

- **push to `main`** → publishes `<version>-dev.<shortSha>` under dist-tag `dev`
- **semver tag** (e.g. `0.1.3`) → publishes the exact `<tag>` under dist-tag `latest` (release parity)

## Cutting a release

One command does everything — bump every public package, commit, tag, push (which triggers the
GitHub Packages release-parity publish), and publish to **npm**:

```bash
bun run release 0.1.3        # dry run: DRY_RUN=1 bun run release 0.1.3
```

`scripts/release.ts` requires a **clean working tree** and refuses if the **tag already exists**.
You must be logged in to npm (`bun pm whoami`).

## Gotchas (these have bitten us)

1. **Push release tags one at a time.** GitHub will not create workflow events for tags
   _"when more than three tags are pushed at once"_ — so a bulk `git push --tags` (e.g. during a
   repo migration) silently skips the GitHub Packages publish. `release.ts` pushes a single tag,
   so this only bites manual bulk pushes.

2. **Bump source _before_ tagging — don't hand-create tags.** GitHub Packages release-parity uses
   the **tag name** as the published version, but npm (`bun publish`) uses **`package.json`**. A
   tag created ahead of a version bump publishes the tag-version to GitHub Packages while npm
   stays on the old source version. `release.ts` keeps them in lockstep (bump → commit → tag);
   `git tag` by hand does not.

3. **All packages, one version.** Every public package is released at the same version; never
   cherry-publish one.

## Reconciling when a tag is already ahead of source

If a tag was pushed ahead of the bump (GitHub Packages has `0.1.2` but npm is still on the old
version), don't fight `release.ts` (it refuses an existing tag). Republish the **already-correct
GitHub Packages tarball** straight to npm — byte-identical, no source churn, and it self-heals on
the next `bun run release` (which sets an absolute version):

```bash
TOKEN=$(gh auth token)   # needs read:packages
VER=0.1.2
for pkg in contracts qti-xml pci-math-entry qti-react common-cartridge; do
  URL=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://npm.pkg.github.com/@conform-ed%2f$pkg" | jq -r ".versions[\"$VER\"].dist.tarball")
  curl -sL -H "Authorization: Bearer $TOKEN" -o "$pkg.tgz" "$URL"   # -L: 302s to blob storage
  bun publish --tag latest --access public --registry=https://registry.npmjs.org "$pkg.tgz"
done
```

(Consumers: emergent treats GitHub Packages as a local-only dev channel and otherwise installs
releases from public npm — see emergent's `docs/runbooks/consuming-conform-ed-and-pgxsinkit.md`.)
