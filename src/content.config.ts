import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const people = defineCollection({
	loader: glob({
		pattern: '*.json',
		base: './src/content/people',
	}),
	schema: z.object({
		order: z.number().int().nonnegative(),
		name: z.string(),
		subtitle: z.string(),
		subsubtitle: z.string(),
		cardType: z.enum(['xiaoke', 'lanfeng', 'd00', 'placeholder']),
		tags: z.array(z.string()).min(3).max(8),
		notes: z.array(z.string()).min(3).max(8),
	}),
});

export const collections = {
	people,
};
