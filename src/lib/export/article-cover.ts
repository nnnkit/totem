function isLikelyProfileAvatarUrl(value: string): boolean {
  return /\/profile_images\//i.test(value);
}

function normalizeAvatarCandidateUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutHash = trimmed.split("#")[0];
  const [withoutQuery] = withoutHash.split("?");

  return withoutQuery
    .replace(/_(normal|bigger|mini)(?=\.[a-z0-9]+$)/i, "")
    .toLowerCase();
}

export function resolveArticleCoverImageUrl(
  coverImageUrl: string | undefined,
  authorProfileImageUrl: string | undefined,
): string {
  const cover = coverImageUrl?.trim() || "";
  if (!cover) return "";
  if (isLikelyProfileAvatarUrl(cover)) return "";

  const authorAvatar = authorProfileImageUrl?.trim() || "";
  if (!authorAvatar) return cover;

  const normalizedCover = normalizeAvatarCandidateUrl(cover);
  const normalizedAvatar = normalizeAvatarCandidateUrl(authorAvatar);
  if (normalizedCover && normalizedCover === normalizedAvatar) {
    return "";
  }

  return cover;
}
