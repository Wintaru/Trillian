export interface CleanLinksRequest {
  messageContent: string;
}

export interface CleanedUrl {
  original: string;
  cleaned: string;
}

export interface CleanLinksResponse {
  cleanedUrls: CleanedUrl[];
}
