/**
 * Minecraft's launcher logging config emits log4j XML events on stdout.
 * This converts that stream into readable "[time] [thread/LEVEL] (logger) message" lines;
 * anything that is not part of an XML event is passed through unchanged.
 */
export class Log4jXmlParser {
  private buffer = "";

  feed(chunk: string): string[] {
    this.buffer += chunk;
    const out: string[] = [];
    for (;;) {
      const start = this.buffer.indexOf("<log4j:Event");
      const plainEnd = start === -1 ? this.buffer.lastIndexOf("\n") + 1 : start;
      if (plainEnd > 0) {
        for (const line of this.buffer.slice(0, plainEnd).split(/\r?\n/)) if (line.trim()) out.push(line);
        this.buffer = this.buffer.slice(plainEnd);
        continue;
      }
      if (start !== 0) break;
      const end = this.buffer.indexOf("</log4j:Event>");
      if (end === -1) break;
      out.push(...formatEvent(this.buffer.slice(0, end)));
      this.buffer = this.buffer.slice(end + "</log4j:Event>".length).replace(/^\r?\n/, "");
    }
    return out;
  }

  flush(): string[] {
    const rest = this.buffer;
    this.buffer = "";
    return rest.split(/\r?\n/).filter((l) => l.trim());
  }
}

function attr(xml: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? "";
}

function cdata(xml: string, tag: string): string | null {
  const m = new RegExp(`<log4j:${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></log4j:${tag}>`).exec(xml);
  return m ? m[1] : null;
}

function formatEvent(xml: string): string[] {
  const ts = Number(attr(xml, "timestamp"));
  const time = Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString().slice(11, 19) : "--:--:--";
  const prefix = `[${time}] [${attr(xml, "thread")}/${attr(xml, "level")}] (${attr(xml, "logger")})`;
  const lines = [`${prefix} ${cdata(xml, "Message") ?? ""}`];
  const thrown = cdata(xml, "Throwable");
  if (thrown) lines.push(...thrown.split(/\r?\n/).filter((l) => l.trim()));
  return lines;
}
