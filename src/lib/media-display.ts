export function toSafeMediaDisplay(input: {
  isBlocked: boolean;
  title: string | null;
  imageUrl: string | null;
  blockedTitle: string;
}) {
  if (input.isBlocked) {
    return {
      title: input.blockedTitle,
      imageUrl: null,
    };
  }

  return {
    title: input.title,
    imageUrl: input.imageUrl,
  };
}
