const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const FORMAT_REGEX = /^[A-Za-z0-9_+*\-.,:/\[\]<>=%]+$/;

export function validateVideoId(videoId: string): string {
  if (!VIDEO_ID_REGEX.test(videoId)) {
    throw new Error("Invalid video id format.");
  }
  return videoId;
}

export function validateFormat(format: string): string {
  if (!format || format.length > 200 || !FORMAT_REGEX.test(format)) {
    throw new Error("Invalid format selector.");
  }
  return format;
}
