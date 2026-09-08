import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const RENDER_API_BASE_URL = "https://api.render.com/v1";

function parseArgs(argv) {
  const options = {
    apiBaseUrl: process.env.RENDER_API_BASE_URL || RENDER_API_BASE_URL,
    apiKey: process.env.RENDER_API_KEY || process.env.RENDER_API_TOKEN || "",
    apply: false,
    deploy: false,
    deployMode: "deploy_only",
    envFile: ".env",
    exampleFile: ".env.example",
    includeEmpty: false,
    missingOnly: false,
    serviceId: process.env.RENDER_SERVICE_ID || "",
    showValues: false,
  };

  argv.forEach((arg) => {
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--deploy") {
      options.deploy = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--include-empty") {
      options.includeEmpty = true;
    } else if (arg === "--missing-only") {
      options.missingOnly = true;
    } else if (arg === "--show-values") {
      options.showValues = true;
    } else if (arg.startsWith("--api-base-url=")) {
      options.apiBaseUrl = arg.slice("--api-base-url=".length);
    } else if (arg.startsWith("--api-key=")) {
      options.apiKey = arg.slice("--api-key=".length);
    } else if (arg.startsWith("--deploy-mode=")) {
      options.deployMode = arg.slice("--deploy-mode=".length);
    } else if (arg.startsWith("--env-file=")) {
      options.envFile = arg.slice("--env-file=".length);
    } else if (arg.startsWith("--example-file=")) {
      options.exampleFile = arg.slice("--example-file=".length);
    } else if (arg.startsWith("--service-id=")) {
      options.serviceId = arg.slice("--service-id=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  });

  return options;
}

function printHelp() {
  console.log(`
Usage:
  npm run render-env:audit
  npm run render-env:audit -- --service-id=srv_xxx
  npm run render-env:sync -- --service-id=srv_xxx --apply
  npm run render-env:sync -- --service-id=srv_xxx --apply --deploy

Environment:
  RENDER_API_KEY      Render API key. Prefer this over --api-key.
  RENDER_SERVICE_ID   Render service ID, e.g. srv-...

Options:
  --apply             Upsert local .env keys to Render.
  --deploy            Trigger a deploy after successful updates.
  --deploy-mode=MODE  deploy_only or build_and_deploy. Default: deploy_only.
  --env-file=PATH     Local env file to read. Default: .env.
  --example-file=PATH Local example env file for local audit. Default: .env.example.
  --include-empty     Include empty local values when syncing.
  --missing-only      Only create missing Render keys; do not update changed values.
  --show-values       Show masked values in audit output.
`);
}

function stripInlineComment(value) {
  let quote = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if (!quote && (char === "\"" || char === "'")) {
      quote = char;
      continue;
    }

    if (quote && char === quote && previous !== "\\") {
      quote = "";
      continue;
    }

    if (!quote && char === "#" && /\s/.test(previous ?? "")) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function parseQuotedValue(value) {
  const trimmedValue = value.trim();
  const quote = trimmedValue[0];

  if (
    (quote !== "\"" && quote !== "'") ||
    trimmedValue[trimmedValue.length - 1] !== quote
  ) {
    return stripInlineComment(trimmedValue);
  }

  const unquotedValue = trimmedValue.slice(1, -1);

  if (quote === "'") {
    return unquotedValue.replace(/\\'/g, "'");
  }

  return unquotedValue.replace(/\\([nrt"\\])/g, (_, escaped) => {
    const replacements = {
      "\"": "\"",
      "\\": "\\",
      n: "\n",
      r: "\r",
      t: "\t",
    };

    return replacements[escaped] ?? escaped;
  });
}

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { entries: new Map(), missing: true };
  }

  const entries = new Map();
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      return;
    }

    entries.set(match[1], {
      key: match[1],
      line: index + 1,
      value: parseQuotedValue(match[2] ?? ""),
    });
  });

  return { entries, missing: false };
}

function maskValue(value) {
  if (value === "") {
    return "(empty)";
  }

  if (value.length <= 6) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function toSortedKeys(entries) {
  return [...entries.keys()].sort((left, right) => left.localeCompare(right));
}

function printList(title, values, options = {}) {
  console.log(`${title}: ${values.length}`);

  values.forEach((value) => {
    if (typeof value === "string") {
      console.log(`  - ${value}`);
      return;
    }

    const suffix =
      options.showValues && "value" in value
        ? ` = ${maskValue(String(value.value ?? ""))}`
        : "";

    console.log(`  - ${value.key}${suffix}`);
  });
}

async function renderRequest(options, pathname, requestOptions = {}) {
  const response = await fetch(`${options.apiBaseUrl}${pathname}`, {
    ...requestOptions,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${options.apiKey}`,
      ...(requestOptions.body ? { "content-type": "application/json" } : {}),
      ...requestOptions.headers,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Render API request failed with HTTP ${response.status}`;

    throw new Error(message);
  }

  return payload;
}

function getCursorFromEnvVarPage(page) {
  if (!Array.isArray(page) || !page.length) {
    return "";
  }

  return page[page.length - 1]?.cursor ?? "";
}

async function listRenderEnvVars(options) {
  const entries = new Map();
  let cursor = "";

  do {
    const query = new URLSearchParams({ limit: "100" });

    if (cursor) {
      query.set("cursor", cursor);
    }

    const page = await renderRequest(
      options,
      `/services/${encodeURIComponent(options.serviceId)}/env-vars?${query.toString()}`,
    );

    page.forEach((item) => {
      const envVar = item.envVar ?? item;

      if (envVar?.key) {
        entries.set(envVar.key, {
          key: envVar.key,
          value: String(envVar.value ?? ""),
        });
      }
    });

    cursor = getCursorFromEnvVarPage(page);
  } while (cursor);

  return entries;
}

async function upsertRenderEnvVar(options, key, value) {
  return renderRequest(
    options,
    `/services/${encodeURIComponent(options.serviceId)}/env-vars/${encodeURIComponent(key)}`,
    {
      body: JSON.stringify({ value }),
      method: "PUT",
    },
  );
}

async function triggerRenderDeploy(options) {
  return renderRequest(
    options,
    `/services/${encodeURIComponent(options.serviceId)}/deploys`,
    {
      body: JSON.stringify({ deployMode: options.deployMode }),
      method: "POST",
    },
  );
}

function compareLocalFiles(localEntries, exampleEntries) {
  const localKeys = new Set(localEntries.keys());
  const exampleKeys = new Set(exampleEntries.keys());

  return {
    exampleOnly: toSortedKeys(exampleEntries).filter((key) => !localKeys.has(key)),
    localOnly: toSortedKeys(localEntries).filter((key) => !exampleKeys.has(key)),
  };
}

function compareRenderEnv(localEntries, remoteEntries, options) {
  const localKeys = toSortedKeys(localEntries);
  const remoteKeys = toSortedKeys(remoteEntries);
  const remoteKeySet = new Set(remoteKeys);
  const localKeySet = new Set(localKeys);
  const skippedEmpty = localKeys
    .filter((key) => !options.includeEmpty && localEntries.get(key)?.value === "")
    .map((key) => ({ key, value: "" }));
  const comparableLocalKeys = localKeys.filter(
    (key) => options.includeEmpty || localEntries.get(key)?.value !== "",
  );
  const missing = comparableLocalKeys
    .filter((key) => !remoteKeySet.has(key))
    .map((key) => localEntries.get(key));
  const changed = comparableLocalKeys
    .filter((key) => {
      if (!remoteKeySet.has(key)) {
        return false;
      }

      return localEntries.get(key)?.value !== remoteEntries.get(key)?.value;
    })
    .map((key) => localEntries.get(key));
  const extra = remoteKeys.filter((key) => !localKeySet.has(key));

  return {
    changed,
    extra,
    missing,
    skippedEmpty,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const envFilePath = path.resolve(process.cwd(), options.envFile);
  const exampleFilePath = path.resolve(process.cwd(), options.exampleFile);
  const localEnv = parseDotEnvFile(envFilePath);
  const exampleEnv = parseDotEnvFile(exampleFilePath);

  if (localEnv.missing) {
    throw new Error(`Cannot find env file: ${options.envFile}`);
  }

  console.log("Render environment audit");
  console.log(`Local env file: ${options.envFile} (${localEnv.entries.size} keys)`);

  if (!exampleEnv.missing) {
    const localComparison = compareLocalFiles(localEnv.entries, exampleEnv.entries);

    console.log(`Example env file: ${options.exampleFile} (${exampleEnv.entries.size} keys)`);
    printList("Keys in .env but not .env.example", localComparison.localOnly);
    printList("Keys in .env.example but not .env", localComparison.exampleOnly);
  }

  if (!options.apiKey || !options.serviceId) {
    console.log("");
    console.log("Render API audit skipped.");
    console.log("Set RENDER_API_KEY and RENDER_SERVICE_ID, or pass --service-id.");
    console.log("Run with --apply only when you want to update Render.");
    return;
  }

  const remoteEntries = await listRenderEnvVars(options);
  const renderComparison = compareRenderEnv(localEnv.entries, remoteEntries, options);
  const updates = options.missingOnly
    ? renderComparison.missing
    : [...renderComparison.missing, ...renderComparison.changed];

  console.log("");
  console.log(`Render service: ${options.serviceId}`);
  console.log(`Render direct env vars: ${remoteEntries.size} keys`);
  printList("Missing on Render", renderComparison.missing, options);
  printList("Different values on Render", renderComparison.changed, options);
  printList("Extra on Render", renderComparison.extra);
  printList("Empty local values skipped", renderComparison.skippedEmpty);

  if (!updates.length) {
    console.log("");
    console.log("No Render env updates needed.");
    return;
  }

  if (!options.apply) {
    console.log("");
    console.log(`Dry run only. ${updates.length} Render env var(s) would be upserted.`);
    console.log("Re-run with --apply to update Render.");
    return;
  }

  console.log("");
  console.log(`Updating ${updates.length} Render env var(s)...`);

  for (const entry of updates) {
    await upsertRenderEnvVar(options, entry.key, entry.value);
    console.log(`  updated ${entry.key}`);
  }

  if (options.deploy) {
    const deploy = await triggerRenderDeploy(options);
    const deployId = deploy?.id ?? deploy?.deploy?.id ?? "(unknown deploy id)";

    console.log(`Triggered Render deploy: ${deployId}`);
  } else {
    console.log("Render env vars updated. Trigger a deploy when you are ready.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
