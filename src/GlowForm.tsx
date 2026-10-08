import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Clipboard, Clock3, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const localePresets = [
  { name: "Palmer", label: "Palmer" },
  { name: "Crace", label: "Crace" },
  { name: "Kaleen", label: "Kaleen" },
  { name: "Giralang", label: "Gira" },
  { name: "Gungahlin", label: "Gung" },
  { name: "Franklin", label: "Franklin" },
  { name: "Harrison", label: "Harrison" },
  { name: "Belconnen", label: "Belco" },
];

type FormStatus = {
  kind: "info" | "success" | "error";
  message: string;
};

function currentTime(): string {
  return new Date().toLocaleTimeString("en-AU", { hour12: false });
}

function getAnonymousId(): string {
  const existingId = localStorage.getItem("glow_anon_id");
  if (existingId) return existingId;

  const id = `anon_${crypto.randomUUID()}`;
  localStorage.setItem("glow_anon_id", id);
  return id;
}

function localDateTimeFor(time: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)) return "";
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, seconds ?? 0, 0);
  return date.toISOString();
}

export default function GlowForm() {
  const [message, setMessage] = useState("System operating normally across regional grid.");
  const [locale, setLocale] = useState("Palmer");
  const [timestamp, setTimestamp] = useState(currentTime);
  const [userEmail, setUserEmail] = useState("");
  const [anonymousId] = useState(getAnonymousId);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>({
    kind: "info",
    message: "Form ready. Configure the payload, then submit it.",
  });

  const payload = useMemo(
    () => ({
      message,
      locale,
      timestamp,
      user_email: userEmail,
      anonymous_id: anonymousId,
      created_at: localDateTimeFor(timestamp),
    }),
    [message, locale, timestamp, userEmail, anonymousId],
  );

  function resetForm() {
    setMessage("System operating normally across regional grid.");
    setLocale("Palmer");
    setTimestamp(currentTime());
    setUserEmail("");
    setStatus({ kind: "info", message: "Form reset to default parameters." });
  }

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatus({ kind: "success", message: "JSON copied to clipboard." });
    } catch {
      setStatus({ kind: "error", message: "Could not copy JSON to the clipboard." });
    }
  }

  async function submitPayload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ kind: "info", message: "Sending payload to the Bun API…" });

    try {
      const response = await fetch("/api/glow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let result: { message?: string; error?: string } = {};
      if (text) {
        try {
          result = JSON.parse(text) as typeof result;
        } catch {
          throw new Error(`API returned an invalid response (${response.status}).`);
        }
      }
      if (!response.ok) {
        throw new Error(result.error ?? `Server returned status ${response.status}.`);
      }
      setStatus({
        kind: "success",
        message: result.message ?? "Payload saved successfully.",
      });
    } catch (cause) {
      setStatus({
        kind: "error",
        message: cause instanceof TypeError
          ? 'Could not reach the API. Start it with "bun run api".'
          : cause instanceof Error
            ? cause.message
            : "Payload submission failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const statusStyle = {
    info: "border-blue-200 bg-blue-50 text-blue-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
  }[status.kind];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-[#f78522] shadow-[0_0_8px_#f78522]" />
            <span className="text-sm font-semibold tracking-wide text-slate-900">IGlow Portal</span>
          </div>
          <a
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Activity
          </a>
          <a
            className="text-sm font-medium text-primary hover:underline"
            href="/signin.html"
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:py-10">
        <Card className="gap-0 border-slate-200 p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_2px_6px_-1px_rgba(15,23,42,0.03)] sm:p-8 lg:col-span-7">
          <CardHeader className="mb-6 flex-row items-start justify-between border-b border-slate-100 px-0 pb-5">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight">Payload Configuration</CardTitle>
              <CardDescription>Configure IGlowData parameters in real time.</CardDescription>
            </div>
            <div className="hidden items-center gap-2 pt-1 sm:flex" aria-label="Glow accent colors">
              {["#f78522", "#BF8040", "#406ABF", "#BF4040", "#950495"].map((color) => (
                <span
                  className="size-2.5 rounded-full"
                  key={color}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="px-0">
            <form className="space-y-6" onSubmit={submitPayload}>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="message">
                  Message Payload
                </label>
                <Textarea
                  className="min-h-24 resize-y rounded-xl border-slate-200 bg-slate-50 px-4 py-3 focus-visible:bg-white focus-visible:ring-blue-600/20"
                  id="message"
                  maxLength={2000}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  value={message}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="locale">
                  Locale Preset / Custom
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {localePresets.map((preset) => (
                    <Button
                      className={`h-10 rounded-xl border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:border-primary hover:bg-blue-50 hover:text-primary ${
                        locale === preset.name ? "border-primary bg-blue-50 text-primary" : ""
                      }`}
                      key={preset.name}
                      onClick={() => setLocale(preset.name)}
                      type="button"
                      variant="outline"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Input
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 px-4 focus-visible:bg-white focus-visible:ring-blue-600/20"
                  id="locale"
                  maxLength={100}
                  onChange={(event) => setLocale(event.target.value)}
                  placeholder="Select a preset or enter a custom locale"
                  required
                  value={locale}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="timestamp">
                    Timestamp (HH:MM:SS)
                  </label>
                  <Button
                    className="h-auto px-0 text-xs text-primary hover:bg-transparent hover:text-blue-700"
                    onClick={() => {
                      setTimestamp(currentTime());
                      setStatus({ kind: "info", message: "Timestamp synced to your current local time." });
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <Clock3 data-icon="inline-start" />
                    Sync current time
                  </Button>
                </div>
                <Input
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 px-4 font-mono focus-visible:bg-white focus-visible:ring-blue-600/20"
                  id="timestamp"
                  onChange={(event) => setTimestamp(event.target.value)}
                  pattern="([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]"
                  placeholder="HH:MM:SS"
                  required
                  title="Enter time in 24-hour HH:MM:SS format."
                  value={timestamp}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="user-email">
                  User Email
                </label>
                <Input
                  autoComplete="email"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 px-4 focus-visible:bg-white focus-visible:ring-blue-600/20"
                  id="user-email"
                  onChange={(event) => setUserEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={userEmail}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button
                  className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:bg-blue-700"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting
                    ? <LoaderCircle className="animate-spin" data-icon="inline-start" />
                    : <Send data-icon="inline-start" />}
                  Submit
                </Button>
                <Button
                  className="h-11 rounded-xl border-slate-200 bg-slate-100 px-6 font-semibold text-slate-700 hover:bg-slate-200"
                  onClick={resetForm}
                  type="button"
                  variant="outline"
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-900">Live JSON Preview</h2>
            <Button
              className="rounded-xl border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              onClick={() => void copyPayload()}
              type="button"
              variant="outline"
            >
              <Clipboard data-icon="inline-start" />
              Copy JSON
            </Button>
          </div>

          <Card className="min-h-56 justify-center rounded-xl border-slate-800 bg-slate-900 p-4 shadow-inner">
            <pre className="w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-blue-300">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </Card>

          <div
            aria-live="polite"
            className={`flex min-h-12 items-center rounded-xl border px-4 py-3 text-xs ${statusStyle}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.kind === "success" && <Check className="mr-2 size-4 shrink-0" aria-hidden="true" />}
            {status.message}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        IGlowData Clinical Cadence Portal · Palette: #f78522, #BF8040, #406ABF, #BF4040, #950495
      </footer>
    </div>
  );
}
