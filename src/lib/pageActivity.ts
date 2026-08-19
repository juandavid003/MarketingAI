import { fetchPagePosts, fetchInstagramAccount, fetchInstagramMedia } from "@/lib/meta";

export type ActivityPost = {
  id: string;
  message: string | null;
  createdTime: string;
  permalinkUrl: string | null;
  fullPicture: string | null;
  shares: number;
};

export type InstagramPost = {
  id: string;
  caption: string | null;
  createdTime: string;
  permalinkUrl: string | null;
  mediaType: string | null;
  likes: number;
  comments: number;
};

export type InstagramActivity = {
  username: string;
  followersCount: number | null;
  mediaCount: number | null;
  posts: InstagramPost[];
  error: string | null;
};

export type PageActivity = {
  pageId: string;
  pageName: string;
  instagramUsername: string | null;
  posts: ActivityPost[];
  error: string | null;
  instagram: InstagramActivity | null;
};

type ConnectedPage = {
  facebookPageId: string;
  name: string;
  pageAccessToken: string;
  instagramAccountId: string | null;
  instagramUsername: string | null;
};

async function getInstagramActivity(page: ConnectedPage): Promise<InstagramActivity | null> {
  if (!page.instagramAccountId) return null;

  try {
    const [account, media] = await Promise.all([
      fetchInstagramAccount(page.instagramAccountId, page.pageAccessToken),
      fetchInstagramMedia(page.instagramAccountId, page.pageAccessToken, 10),
    ]);

    const posts = media
      .map((item) => ({
        id: item.id,
        caption: item.caption ?? null,
        createdTime: item.timestamp,
        permalinkUrl: item.permalink ?? null,
        mediaType: item.media_type ?? null,
        likes: item.like_count ?? 0,
        comments: item.comments_count ?? 0,
      }))
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    return {
      username: account.username ?? page.instagramUsername ?? "",
      followersCount: account.followers_count ?? null,
      mediaCount: account.media_count ?? null,
      posts,
      error: null,
    };
  } catch (err) {
    return {
      username: page.instagramUsername ?? "",
      followersCount: null,
      mediaCount: null,
      posts: [],
      error: err instanceof Error ? err.message : "Error desconocido al leer Instagram.",
    };
  }
}

export async function getPageActivity(pages: ConnectedPage[]): Promise<PageActivity[]> {
  return Promise.all(
    pages.map(async (page): Promise<PageActivity> => {
      const instagram = await getInstagramActivity(page);

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
          instagram,
        };
      } catch (err) {
        return {
          pageId: page.facebookPageId,
          pageName: page.name,
          instagramUsername: page.instagramUsername,
          posts: [],
          error: err instanceof Error ? err.message : "Error desconocido al leer esta página.",
          instagram,
        };
      }
    })
  );
}
