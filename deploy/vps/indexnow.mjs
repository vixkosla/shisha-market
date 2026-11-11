// Explicit operator CLI: no scheduler, no publication and no Google Indexing API.
import {readFile, writeFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {request as httpsRequest} from "node:https";
import {pathToFileURL} from "node:url";

const origin = "https://shisha-market.com";
const keyPath = "/var/lib/shisha-market/indexnow-key.txt";
const keyLocation = `${origin}/indexnow-key.txt`;

export function selectIndexNowUrls(xml) {
  return [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]))].filter(value => {
    try {
      const url = new URL(value);
      if (url.origin !== origin || url.search || url.hash || url.username || url.password) return false;
      return ["/", "/en", "/wiki"].includes(url.pathname) || /^\/wiki\/[a-z0-9-]+\/[a-z0-9-]+$/.test(url.pathname);
    } catch {return false;}
  });
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {family: 4, method: options.method ?? "GET", headers: options.headers}, res => {
      const parts = [];
      res.on("data", part => parts.push(part));
      res.on("end", () => resolve({status: res.statusCode, body: Buffer.concat(parts).toString("utf8")}));
    });
    req.setTimeout(15000, () => req.destroy(new Error("IndexNow network timeout; inspect the result before retrying")));
    req.on("error", reject);
    req.end(options.body);
  });
}

async function main() {
  if (process.argv.includes("--prepare-key")) {
    try {await writeFile(keyPath, randomBytes(32).toString("hex"), {flag: "wx", mode: 0o600});}
    catch (error) {if (error.code !== "EEXIST") throw error;}
    const key = (await readFile(keyPath, "utf8")).trim();
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Existing IndexNow key is invalid; it was not overwritten");
    console.log(JSON.stringify({keyPrepared: true, keyLocation, keyPrinted: false}));
    return;
  }
  const sitemap = await request(`${origin}/sitemap.xml`);
  if (sitemap.status !== 200 || !sitemap.body.includes(`<loc>${origin}/wiki</loc>`)) throw new Error("Public wiki sitemap is not available");
  const urls = selectIndexNowUrls(sitemap.body);
  if (!urls.length || urls.length > 10000) throw new Error("Invalid URL count");
  if (!process.argv.includes("--submit")) {
    console.log(JSON.stringify({dryRun: true, urlCount: urls.length, urls}));
    return;
  }
  const key = (await readFile(keyPath, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid IndexNow key");
  const verification = await request(keyLocation);
  if (verification.status !== 200 || verification.body.trim() !== key) throw new Error("IndexNow verification file is not available on trusted HTTPS");
  const result = await request("https://api.indexnow.org/indexnow", {
    method: "POST", headers: {"content-type": "application/json; charset=utf-8"},
    body: JSON.stringify({host: "shisha-market.com", key, keyLocation, urlList: urls}),
  });
  console.log(JSON.stringify({checkedAt: new Date().toISOString(), endpoint: "https://api.indexnow.org/indexnow", http: result.status, urlCount: urls.length, received: [200,202].includes(result.status), keyValidationPending: result.status === 202, indexed: "not confirmed by submission", keyPrinted: false}));
  if (![200,202].includes(result.status)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("IndexNow operation failed; no credentials were printed. Check connectivity and the verification file before retrying.");
  process.exitCode = 1;
});
