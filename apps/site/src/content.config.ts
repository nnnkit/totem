import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    description: z.string(),
    publishedAt: z.union([z.string(), z.date()]).optional(),
    draft: z.boolean().optional().default(false),
    canonicalKeyword: z.string().optional(),
  }),
});

export const collections = { blog };
