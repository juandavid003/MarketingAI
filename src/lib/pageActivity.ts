import { fetchPagePosts } from "@/lib/meta";

export type ActivityPost = {
  id: string;
  message: string | null;
  createdTime: string;
  permalinkUrl: string | null;
  fullPicture: string | null;
  shares: number;
};

export type PageActivity = {
  pageId: string;
  pageName: string;
  instagramUsername: string | null;
  posts: ActivityPost[];
  error: string | null;
};

type ConnectedPage = {
  facebookPageId: string;
  name: string;
  pageAccessToken: string;
  instagramUsername: string | null;
};

export async function getPageActivity(pages: ConnectedPage[]): Promise<PageActivity[]> {
  return Promise.all(
    pages.map(async (page): Promise<PageActivity> => {
      try {
        const posts = await fetchPagePosts(page.facebookPageId, page.pageAccessToken, 10);
        const mapped = posts
          .map((post) => ({
            id: post.id,
            message: post.message ?? null,
            createdTime: post.created_time,
            permalinkUrl: post.permalink_url ?? null,
            fullPicture: post.full_picture ?? null,
            shares: post.shares?.count ?? 0,
          }))
          .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

        return {
          pageId: page.facebookPageId,
          pageName: page.name,
          instagramUsername: page.instagramUsername,
          posts: mapped,
          error: null,
        };
      } catch (err) {
        return {
          pageId: page.facebookPageId,
          pageName: page.name,
          instagramUsername: page.instagramUsername,
          posts: [],
          error: err instanceof Error ? err.message : "Error desconocido al leer esta página.",
        };
      }
    })
  );
}
