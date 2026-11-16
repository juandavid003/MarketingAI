import { fetchPostEngagement } from "@/lib/meta";
import { decryptToken } from "@/lib/crypto";

export type PublishedPostPerformance = {
  contentIndex: number;
  pageName: string;
  permalinkUrl: string | null;
  shares: number;
  likes: number | null;
  comments: number | null;
  engagementScore: number;
};

type PublishedPostInput = {
  contentIndex: number;
  facebookPageId: string;
  facebookPostId: string;
  pageName: string;
  permalinkUrl: string | null;
};

type PageToken = { facebookPageId: string; pageAccessToken: string };

// Weighted so a share (a real endorsement, costs the sharer social capital)
// counts for more than a like, with comments in between — rough but good
// enough to rank pieces of the same campaign against each other.
function scoreEngagement(shares: number, likes: number | null, comments: number | null): number {
  return shares * 3 + (comments ?? 0) * 2 + (likes ?? 0);
}

export async function getCampaignPerformance(
  publishedPosts: PublishedPostInput[],
  pages: PageToken[]
): Promise<PublishedPostPerformance[]> {
  const tokenByPage = new Map(pages.map((p) => [p.facebookPageId, decryptToken(p.pageAccessToken)]));

  const results = await Promise.all(
    publishedPosts.map(async (post): Promise<PublishedPostPerformance | null> => {
      const token = tokenByPage.get(post.facebookPageId);
      if (!token) return null;

      try {
        const engagement = await fetchPostEngagement(post.facebookPostId, token);
        return {
          contentIndex: post.contentIndex,
          pageName: post.pageName,
          permalinkUrl: post.permalinkUrl,
          shares: engagement.shares,
          likes: engagement.likes,
          comments: engagement.comments,
          engagementScore: scoreEngagement(engagement.shares, engagement.likes, engagement.comments),
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is PublishedPostPerformance => r !== null);
}

export type PerformanceHighlight = {
  best: PublishedPostPerformance;
  multiplier: number;
};

// Surfaces "this piece is working N× better" only when there's a real gap —
// needs at least two measured posts and a meaningful lead over the rest.
export function findPerformanceHighlight(
  performance: PublishedPostPerformance[]
): PerformanceHighlight | null {
  if (performance.length < 2) return null;

  const sorted = [...performance].sort((a, b) => b.engagementScore - a.engagementScore);
  const [best, ...rest] = sorted;
  const restAvg = rest.reduce((sum, p) => sum + p.engagementScore, 0) / rest.length;

  if (best.engagementScore === 0 || restAvg === 0) return null;

  const multiplier = best.engagementScore / restAvg;
  if (multiplier < 1.3) return null;

  return { best, multiplier };
}
