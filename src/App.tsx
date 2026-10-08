import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, LoaderCircle, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UserLog = {
  id: number;
  userEmail: string;
  locale: string;
  lastSeen: string | null;
};

function formatTime(value: string | null): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isFuture(value: string | null): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export default function App() {
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("all");
  const [showPastRows, setShowPastRows] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch("/api/glow/logs");
        const responseText = await response.text();
        let body: {
          logs?: UserLog[];
          error?: string;
        } = {};
        if (responseText) {
          try {
            body = JSON.parse(responseText) as typeof body;
          } catch {
            if (response.ok) {
              throw new Error("The API returned an invalid response.");
            }
          }
        }
        if (!response.ok) {
          throw new Error(
            body.error ??
              `API request failed (${response.status}). Make sure the Bun API is running with "bun run api".`,
          );
        }
        setLogs(body.logs ?? []);
      } catch (cause) {
        setError(
          cause instanceof TypeError
            ? 'Could not reach the API. Start it in a terminal with "bun run api".'
            : cause instanceof Error
              ? cause.message
              : "Could not load users.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, []);

  const visibleLogs = logs
    .filter((log) => selectedEmail === "all" || log.userEmail === selectedEmail)
    .filter((log) => showPastRows || isFuture(log.lastSeen));

  return (
    <main className="flex min-h-screen items-start justify-center bg-background px-4 py-12 text-foreground">
      <Card className="w-full max-w-2xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_2px_6px_-1px_rgba(15,23,42,0.03)]">
        <CardHeader>
          <CardTitle>Recent user activity</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardDescription>All locale activity, newest and future-dated rows first.</CardDescription>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                checked={showPastRows}
                className="size-4 accent-primary"
                onChange={(event) => setShowPastRows(event.target.checked)}
                type="checkbox"
              />
              Show past rows
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && !error && logs.length > 0 && (
            <label className="mb-4 grid gap-2 text-sm">
              <span className="font-medium">Filter by email</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSelectedEmail(event.target.value)}
                value={selectedEmail}
              >
                <option value="all">All</option>
                {[...new Set(logs.map((log) => log.userEmail))].map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </label>
          )}
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="py-4 text-sm text-destructive">{error}</p>
          ) : logs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No activity found.</p>
          ) : visibleLogs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No future-dated rows match this filter. Check “Show past rows” to include older activity.
            </p>
          ) : (
            <ul className="divide-y">
              {visibleLogs.map((log) => (
                <li
                  className="flex flex-col gap-2 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                  key={log.id}
                >
                  <span className="break-all text-sm font-medium">{log.userEmail}</span>
                  <span className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {log.locale}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {formatTime(log.lastSeen)}
                      {isFuture(log.lastSeen) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3" aria-hidden="true" />
                          Future
                        </span>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
