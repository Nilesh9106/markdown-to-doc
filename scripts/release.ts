import { $ } from "bun";

const version = prompt("Version to release (e.g. 1.2.0):")?.trim();
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Invalid version.");
  process.exit(1);
}

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main") {
  console.error(`Releases are cut from main, currently on ${branch}.`);
  process.exit(1);
}

if ((await $`git status --porcelain`.text()).trim()) {
  console.error("Working tree is not clean.");
  process.exit(1);
}

await $`git fetch origin main --tags`.quiet();

if ((await $`git rev-list HEAD..origin/main --count`.text()).trim() !== "0") {
  console.error("main is behind origin/main. Pull first.");
  process.exit(1);
}

if ((await $`git tag -l v${version}`.text()).trim()) {
  console.error(`Tag v${version} already exists. Pick a new version.`);
  process.exit(1);
}

const pkg: { version: string } = await Bun.file("package.json").json();
if (pkg.version === version) {
  console.error(`package.json is already at ${version}.`);
  process.exit(1);
}

pkg.version = version;
await Bun.write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const changelogPath = "CHANGELOG.md";
const changelog = await Bun.file(changelogPath).text();
const unreleased = changelog.match(/## \[Unreleased\]\n([\s\S]*?)(?=\n## \[)/);

if (!unreleased?.[1]?.trim()) {
  console.error("No entries under [Unreleased] in CHANGELOG.md.");
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
await Bun.write(
  changelogPath,
  changelog.replace("## [Unreleased]\n", `## [Unreleased]\n\n## [${version}] - ${date}\n`),
);

await $`bun run format`;
await $`bun run ci:check`;

await $`git add package.json CHANGELOG.md`;
await $`git commit -m ${`chore(release): cut v${version}`}`;
await $`git push origin main`;
await $`git tag -a v${version} -m ${`v${version}`}`;
await $`git push origin v${version}`;

console.log(`Released v${version}. Check: gh run list --workflow "Publish to npm" --limit 3`);
