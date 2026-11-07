import { describe, expect, test } from "bun:test";
import { parseKeywords, publishedPosts, renderMarkdown, slugify, type BlogPost } from "./blog";

describe("blog helpers", () => {
  test("slugify makes URL-safe slugs", () => {
    expect(slugify("Bakit Iba ang GoPalengke? Ñ 3%!")).toBe("bakit-iba-ang-gopalengke-n-3");
  });
  test("keywords are trimmed and de-duplicated", () => {
    expect(parseKeywords("online palengke, Online Palengke ,  grab ,")).toEqual(["online palengke", "grab"]);
  });
  test("drafts never appear publicly", () => {
    const base = { content: "", excerpt: "", coverImage: "", category: "", seoTitle: "", seoDescription: "", keywords: [], updatedAt: "", title: "", slug: "" };
    const posts = [
      { ...base, id: "a", status: "draft", publishedAt: null },
      { ...base, id: "b", status: "published", publishedAt: "2026-01-01" },
    ] as BlogPost[];
    expect(publishedPosts(posts).map((p) => p.id)).toEqual(["b"]);
  });
  test("markdown escapes raw HTML", () => {
    expect(renderMarkdown("<script>x</script>")).not.toContain("<script>");
  });
});
