/**
 * API tests for PulseMCP v0.1 endpoint
 * Run with: bun run src/api.test.ts
 *
 * These tests validate that the PulseMCP API is still returning
 * the expected schema. They help catch breaking changes early.
 */

const BASE_URL = "https://api.pulsemcp.com/v0.1";
const API_KEY = "ee8403eb-e9f7-4b10-8125-c821c14dce5d";
const TENANT_ID = "pulsemcp-all";

interface ServerRepository {
  url: string;
  source: string;
  id?: string;
}

interface ServerRemote {
  type: string;
  url: string;
}

interface ServerPackage {
  registry_name: string;
  name: string;
  version?: string;
}

interface ServerDefinition {
  name: string;
  title?: string;
  description?: string;
  version?: string;
  websiteUrl?: string;
  repository?: ServerRepository;
  remotes?: ServerRemote[];
  packages?: ServerPackage[];
}

interface PulseMCPServerMeta {
  visitorsEstimateMostRecentWeek?: number;
  visitorsEstimateLastFourWeeks?: number;
  visitorsEstimateTotal?: number;
  isOfficial?: boolean;
}

interface PulseMCPVersionMeta {
  source?: string;
  status?: string;
  publishedAt?: string;
  updatedAt?: string;
  isLatest?: boolean;
}

interface ServerEntry {
  server: ServerDefinition;
  _meta?: {
    "com.pulsemcp/server"?: PulseMCPServerMeta;
    "com.pulsemcp/server-version"?: PulseMCPVersionMeta;
  };
}

interface PulseResponse {
  servers: ServerEntry[];
  metadata?: {
    nextCursor?: string;
    count?: number;
  };
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function fetchServers(search = ""): Promise<PulseResponse> {
  const response = await fetch(`${BASE_URL}/servers?search=${encodeURIComponent(search)}&limit=10&version=latest`, {
    headers: {
      "X-API-Key": API_KEY,
      "X-Tenant-ID": TENANT_ID,
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  console.log("🧪 PulseMCP v0.1 API Tests\n");
  console.log(`Endpoint: ${BASE_URL}/servers\n`);

  await test("API endpoint is reachable", async () => {
    const response = await fetch(`${BASE_URL}/servers?limit=1&version=latest`, {
      headers: {
        "X-API-Key": API_KEY,
        "X-Tenant-ID": TENANT_ID,
      },
    });
    assert(response.ok, `Expected 200, got ${response.status}`);
  });

  await test("Response has expected top-level structure", async () => {
    const data = await fetchServers();
    assert(Array.isArray(data.servers), "Expected 'servers' to be an array");
    assert(data.metadata !== undefined, "Expected 'metadata' to be present");
  });

  await test("Server entries have required structure", async () => {
    const data = await fetchServers();
    assert(data.servers.length > 0, "Expected at least one server");

    const entry = data.servers[0];
    assert("server" in entry, "Expected 'server' field in entry");
    assert("name" in entry.server, "Expected 'name' in server definition");
  });

  await test("Server definition has expected fields", async () => {
    const data = await fetchServers();
    const server = data.servers[0].server;

    const optionalFields = [
      "title",
      "description",
      "version",
      "websiteUrl",
      "repository",
      "remotes",
      "packages",
    ] as const;

    const presentFields = optionalFields.filter((f) => f in server);
    console.log(`   Found ${presentFields.length}/${optionalFields.length} optional fields`);
  });

  await test("PulseMCP metadata enrichments are present", async () => {
    const data = await fetchServers();
    const entry = data.servers[0];

    const serverMeta = entry._meta?.["com.pulsemcp/server"];
    const versionMeta = entry._meta?.["com.pulsemcp/server-version"];

    assert(serverMeta !== undefined, "Expected com.pulsemcp/server metadata");
    assert(versionMeta !== undefined, "Expected com.pulsemcp/server-version metadata");

    if (serverMeta?.visitorsEstimateTotal !== undefined) {
      console.log(`   ✓ visitorsEstimateTotal: ${serverMeta.visitorsEstimateTotal}`);
    }
    if (serverMeta?.isOfficial !== undefined) {
      console.log(`   ✓ isOfficial: ${serverMeta.isOfficial}`);
    }
  });

  await test("Search query works", async () => {
    const data = await fetchServers("filesystem");
    assert(data.servers.length > 0, "Expected search to return results");
  });

  await test("Remotes array has expected structure (if present)", async () => {
    const data = await fetchServers();
    const entryWithRemotes = data.servers.find((e) => e.server.remotes && e.server.remotes.length > 0);

    if (!entryWithRemotes) {
      console.log("   ⚠️  No servers with remotes found - skipping");
      return;
    }

    const remote = entryWithRemotes.server.remotes![0];
    assert("type" in remote, "Remote missing 'type' field");
    assert("url" in remote, "Remote missing 'url' field");
    console.log(`   ✓ Remote type: ${remote.type}`);
  });

  await test("Pagination metadata is present", async () => {
    const data = await fetchServers();
    assert(data.metadata !== undefined, "Expected metadata object");
    console.log(`   ✓ count: ${data.metadata?.count}`);
    if (data.metadata?.nextCursor) {
      console.log(`   ✓ nextCursor present`);
    }
  });

  console.log("\n✨ Tests complete");
}

main().catch(console.error);
