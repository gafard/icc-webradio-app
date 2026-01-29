import AppShell from '../../../components/AppShell';
import ClientWatchPage from './ClientWatchPage';
import { wpFetch } from '../../../lib/wp';

type WPPost = {
  id: number;
  slug: string;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    author?: Array<{ name: string }>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
    'wp:term'?: any;
  };
};

async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const posts = await wpFetch<WPPost[]>(
    `/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed=1`
  );
  return posts?.[0] ?? null;
}

async function getRelatedPostsFromPost(post: WPPost, count = 8): Promise<WPPost[]> {
  const categories =
    post._embedded?.['wp:term']?.[0]?.map((c: any) => c.id)?.filter(Boolean) ?? [];

  const categoryQuery = categories.length ? `&categories=${categories.join(',')}` : '';

  const rel = await wpFetch<WPPost[]>(
    `/wp-json/wp/v2/posts?per_page=${count}&_embed=1&exclude=${post.id}${categoryQuery}`
  );

  if (rel?.length) return rel;

  // fallback : derniers posts (jamais vide)
  const latest = await wpFetch<WPPost[]>(
    `/wp-json/wp/v2/posts?per_page=${count}&_embed=1&orderby=date&order=desc`
  );
  return (latest ?? []).filter((p) => p.id !== post.id);
}

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;

  const post = await getPostBySlug(slug);

  if (!post) {
    return (
      <AppShell>
        <main className="px-4 py-12">
          <div className="mx-auto max-w-3xl text-white">Post introuvable.</div>
        </main>
      </AppShell>
    );
  }

  const relatedPosts = await getRelatedPostsFromPost(post, 8);

  return (
    <AppShell>
      <ClientWatchPage initialPost={post} relatedPosts={relatedPosts} />
    </AppShell>
  );
}