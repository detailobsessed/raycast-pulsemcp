import { Action, ActionPanel, Color, Detail, Icon, Keyboard, List } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useMemo, useState } from "react";

type SortOption = "default" | "popularity" | "name";

// v0.1 API types
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
  $schema?: string;
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

const BASE_URL = "https://api.pulsemcp.com/v0.1";
const API_KEY = "ee8403eb-e9f7-4b10-8125-c821c14dce5d";
const TENANT_ID = "pulsemcp-all";

function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function ServerDetail({ entry }: { entry: ServerEntry }) {
  const server = entry.server;
  const meta = entry._meta?.["com.pulsemcp/server"];
  const versionMeta = entry._meta?.["com.pulsemcp/server-version"];

  const markdown = `
# ${server.title ?? server.name}

${server.description ?? ""}

${
  server.remotes && server.remotes.length > 0
    ? `---

## 🔌 Connection Options
${server.remotes
  .map(
    (remote) => `
### ${remote.type}
-  **URL:** \`${remote.url}\`
`,
  )
  .join("\n")}`
    : ""
}

---
*Data provided by [PulseMCP](https://pulsemcp.com)*
`;

  const repoUrl = server.repository?.url;
  const websiteUrl = server.websiteUrl ?? repoUrl;

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          {websiteUrl && <Detail.Metadata.Link title="Homepage" target={websiteUrl} text="Open" />}
          {repoUrl && <Detail.Metadata.Link title="Source Code" target={repoUrl} text="GitHub" />}
          <Detail.Metadata.Separator />
          {meta && (
            <Detail.Metadata.Label
              title="Popularity"
              text={`👥 ${formatNumber(meta.visitorsEstimateTotal)} total visitors`}
            />
          )}
          {meta?.isOfficial && (
            <Detail.Metadata.TagList title="Status">
              <Detail.Metadata.TagList.Item text="Official" color={Color.Green} />
            </Detail.Metadata.TagList>
          )}
          {server.packages && server.packages.length > 0 && (
            <Detail.Metadata.TagList title="📦 Packages">
              {server.packages.map((pkg, i) => (
                <Detail.Metadata.TagList.Item key={i} text={`${pkg.registry_name}: ${pkg.name}`} color={Color.Orange} />
              ))}
            </Detail.Metadata.TagList>
          )}
          {server.remotes && server.remotes.length > 0 && (
            <Detail.Metadata.TagList title="🔌 Transport">
              {[...new Set(server.remotes.map((r) => r.type))].map((t) => (
                <Detail.Metadata.TagList.Item key={t} text={t} color={Color.Blue} />
              ))}
            </Detail.Metadata.TagList>
          )}
          {versionMeta?.source && <Detail.Metadata.Label title="Source" text={versionMeta.source} />}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          {websiteUrl && <Action.OpenInBrowser url={websiteUrl} title="Open Homepage" icon={Icon.Globe} />}
          {repoUrl && <Action.OpenInBrowser url={repoUrl} title="View Source Code" icon={Icon.Code} />}
          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              content={server.name}
              title="Copy Server Name"
              icon={Icon.Clipboard}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
            {repoUrl && (
              <Action.CopyToClipboard
                content={repoUrl}
                title="Copy Source URL"
                icon={Icon.Link}
                shortcut={Keyboard.Shortcut.Common.CopyPath}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const { data, isLoading, revalidate } = useFetch<PulseResponse>(
    `${BASE_URL}/servers?search=${encodeURIComponent(searchText)}&limit=50&version=latest`,
    {
      headers: {
        "X-API-Key": API_KEY,
        "X-Tenant-ID": TENANT_ID,
      },
      keepPreviousData: true,
    },
  );

  const servers = useMemo(() => {
    const list = data?.servers ?? [];
    if (sortBy === "default") return list;

    return [...list].sort((a, b) => {
      if (sortBy === "popularity") {
        const aPopularity = a._meta?.["com.pulsemcp/server"]?.visitorsEstimateTotal ?? 0;
        const bPopularity = b._meta?.["com.pulsemcp/server"]?.visitorsEstimateTotal ?? 0;
        return bPopularity - aPopularity;
      }
      if (sortBy === "name") {
        return (a.server.name ?? "").localeCompare(b.server.name ?? "");
      }
      return 0;
    });
  }, [data?.servers, sortBy]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search MCP servers..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Sort By" storeValue onChange={(value) => setSortBy(value as SortOption)}>
          <List.Dropdown.Item title="Default" value="default" />
          <List.Dropdown.Item title="Most Popular" value="popularity" icon={Icon.Person} />
          <List.Dropdown.Item title="Name (A-Z)" value="name" icon={Icon.Text} />
        </List.Dropdown>
      }
    >
      {servers.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title={searchText ? "No Servers Found" : "Search MCP Servers"}
          description={searchText ? "Try a different search term" : "Start typing to search the PulseMCP registry"}
        />
      ) : (
        servers.map((entry) => {
          const server = entry.server;
          const meta = entry._meta?.["com.pulsemcp/server"];
          const subtitle = server.description ?? "";
          const truncatedSubtitle = subtitle.length > 50 ? `${subtitle.slice(0, 47)}...` : subtitle;
          const transports = [...new Set((server.remotes?.map((r) => r.type) ?? []).filter(Boolean))];
          const repoUrl = server.repository?.url;
          const websiteUrl = server.websiteUrl ?? repoUrl;

          return (
            <List.Item
              key={server.name}
              title={server.title ?? server.name}
              subtitle={truncatedSubtitle}
              accessories={[
                ...(meta?.isOfficial ? [{ tag: { value: "Official", color: Color.Green } }] : []),
                ...transports.map((t) => ({ tag: { value: t, color: Color.Blue } })),
                ...(meta?.visitorsEstimateTotal
                  ? [
                      {
                        icon: Icon.Person,
                        text: formatNumber(meta.visitorsEstimateTotal),
                        tooltip: `${meta.visitorsEstimateTotal.toLocaleString()} total visitors`,
                      },
                    ]
                  : []),
              ]}
              icon={Icon.Terminal}
              actions={
                <ActionPanel>
                  <Action.Push title="View Details" icon={Icon.Eye} target={<ServerDetail entry={entry} />} />
                  {websiteUrl && <Action.OpenInBrowser url={websiteUrl} title="Open Homepage" icon={Icon.Globe} />}
                  {repoUrl && <Action.OpenInBrowser url={repoUrl} title="View Source Code" icon={Icon.Code} />}
                  <ActionPanel.Section title="Copy">
                    <Action.CopyToClipboard
                      content={server.name}
                      title="Copy Server Name"
                      icon={Icon.Clipboard}
                      shortcut={Keyboard.Shortcut.Common.Copy}
                    />
                    {repoUrl && (
                      <Action.CopyToClipboard
                        content={repoUrl}
                        title="Copy Source URL"
                        icon={Icon.Link}
                        shortcut={Keyboard.Shortcut.Common.CopyPath}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      shortcut={Keyboard.Shortcut.Common.Refresh}
                      onAction={revalidate}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
