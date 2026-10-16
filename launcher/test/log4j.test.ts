import { describe, expect, it } from "vitest";
import { Log4jXmlParser } from "../src/main/util/log4j";

const event = `<log4j:Event logger="Zenith" timestamp="1792185817652" level="INFO" thread="Render thread">
  <log4j:Message><![CDATA[Zenith Client initialised]]></log4j:Message>
</log4j:Event>
`;

describe("Log4jXmlParser", () => {
  it("converts events split across chunks and passes plain lines through", () => {
    const p = new Log4jXmlParser();
    const out = [...p.feed("[main/INFO]: Loading Minecraft 1.21.1 with Fabric Loader\n" + event.slice(0, 40)), ...p.feed(event.slice(40))];
    expect(out[0]).toBe("[main/INFO]: Loading Minecraft 1.21.1 with Fabric Loader");
    expect(out[1]).toMatch(/^\[\d\d:\d\d:\d\d\] \[Render thread\/INFO\] \(Zenith\) Zenith Client initialised$/);
    expect(out).toHaveLength(2);
  });

  it("includes throwables", () => {
    const p = new Log4jXmlParser();
    const out = p.feed(`<log4j:Event logger="x" timestamp="1" level="ERROR" thread="t"><log4j:Message><![CDATA[boom]]></log4j:Message><log4j:Throwable><![CDATA[java.lang.IllegalStateException: bad
\tat a.b(C.java:1)]]></log4j:Throwable></log4j:Event>`);
    expect(out).toEqual([expect.stringContaining("(x) boom"), "java.lang.IllegalStateException: bad", "\tat a.b(C.java:1)"]);
  });
});
