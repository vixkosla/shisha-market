import { describe, expect, it } from "vitest";
import { decodeOperatorPhotos, readOperatorJson } from "@/server/operator-api";

describe("operator request and image budgets", () => {
  it("rejects an oversized declared request before reading its body", async () => {
    await expect(readOperatorJson(new Request("http://localhost", {method: "POST", headers: {"content-length": "99999999"}, body: "{}"}))).rejects.toMatchObject({status: 413});
  });
  it("also bounds chunked bodies without content-length", async () => {
    const body = new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(7 * 1024 * 1024)); controller.enqueue(new Uint8Array(7 * 1024 * 1024)); controller.close();}});
    const request = new Request("http://localhost", {method: "POST", body, duplex: "half"} as RequestInit);
    await expect(readOperatorJson(request)).rejects.toMatchObject({status: 413});
  });
  it("accepts JSON but refuses ambiguous base64 and oversized combined photos", async () => {
    expect(await readOperatorJson(new Request("http://localhost", {method: "POST", body: '{"ok":true}'}))).toEqual({ok: true});
    expect(() => decodeOperatorPhotos([{dataBase64: "data:image/png;base64,YQ=="}])).toThrow(/обычном base64/);
    expect(() => decodeOperatorPhotos([{dataBase64: "YQ==ignored"}])).toThrow();
    const image = Buffer.alloc(4 * 1024 * 1024 + 1).toString("base64");
    expect(() => decodeOperatorPhotos([{dataBase64: image}, {dataBase64: image}])).toThrow(/Общий размер/);
  });
});
