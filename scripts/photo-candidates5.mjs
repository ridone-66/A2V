import { writeFile } from "node:fs/promises";

const UA = "A2V-demo/1.0 (projet pedagogique; contact@a2v.example)";
const queries = [
  "Eames DSW chair",
  "Eames plastic armchair white",
  "molded plastic chair",
  "white sweater",
  "cream sweater",
  "wool sweater flat",
  "sweater on hanger",
];

async function search(query) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1200",
    format: "json",
    origin: "*",
  }).toString();
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  const json = await response.json();
  return Object.values(json.query?.pages ?? {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      return {
        title: page.title.replace(/^File:/, ""),
        width: info.width,
        height: info.height,
        thumb: info.thumburl,
        license: info.extmetadata?.LicenseShortName?.value ?? "?",
        artist: (info.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 120),
        descriptionUrl: info.descriptionurl,
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.width >= 700);
}

const results = {};
for (const query of queries) {
  results[query] = await search(query);
  console.log(`## ${query} (${results[query].length})`);
  results[query].slice(0, 8).forEach((candidate, index) =>
    console.log(" ", index, candidate.title.slice(0, 95), "|", `${candidate.width}x${candidate.height}`, "|", candidate.license),
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await writeFile("scripts/photo-candidates5.json", JSON.stringify(results, null, 2), "utf8");
