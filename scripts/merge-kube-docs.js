const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FILES = [
  'index.md',
  'architecture/index.md',
  'architecture/crate-overview.md',
  'architecture/resource-type-system.md',
  'architecture/client-and-tower-stack.md',
  'architecture/request-lifecycle.md',
  'runtime-internals/index.md',
  'runtime-internals/watcher.md',
  'runtime-internals/reflector-and-store.md',
  'runtime-internals/controller-pipeline.md',
  'runtime-internals/custom-resources.md',
  'patterns/index.md',
  'patterns/reconciler.md',
  'patterns/relations-and-finalizers.md',
  'patterns/server-side-apply.md',
  'patterns/third-party-crds.md',
  'patterns/error-handling-and-backoff.md',
  'patterns/generic-controllers.md',
  'patterns/troubleshooting.md',
  'production/index.md',
  'production/observability.md',
  'production/testing.md',
  'production/optimization.md',
  'production/security.md',
  'production/availability.md',
  'production/admission.md',
];

const LOCALES = {
  ko: path.join(ROOT, 'docs/kube'),
  en: path.join(ROOT, 'i18n/en/docusaurus-plugin-content-docs/current/kube'),
};

function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('---', 3);
  if (end === -1) return content;
  return content.slice(end + 3).trimStart();
}

function stripRelativeLinks(content) {
  // Convert relative doc links to just text (they don't work in standalone md)
  // e.g. [Controller pipeline](../runtime-internals/controller-pipeline.md#trigger-system) → **Controller pipeline**
  return content.replace(/\[([^\]]+)\]\(\.\.[^)]+\)/g, '**$1**');
}

const outDir = path.join(ROOT, 'static/downloads');
fs.mkdirSync(outDir, { recursive: true });

for (const [locale, baseDir] of Object.entries(LOCALES)) {
  const parts = [];

  for (const file of FILES) {
    const filePath = path.join(baseDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  [${locale}] missing: ${file}, skipping`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const content = stripRelativeLinks(stripFrontmatter(raw));
    parts.push(content);
  }

  const output = parts.join('\n\n---\n\n');
  const outFile = path.join(outDir, `kube-docs-${locale}.md`);
  fs.writeFileSync(outFile, output);
  console.log(`[${locale}] ${FILES.length} files → ${path.relative(ROOT, outFile)}`);
}
