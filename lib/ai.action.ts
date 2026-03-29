import {ARCHIFY_AI_RENDER_PROMPT} from "./constants";

const isUnknownSessionError = (error: unknown) => {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("session id unknown");
};

const ensurePuterSession = async (puter: any) => {
  if (!puter.auth.isSignedIn()) {
    await puter.auth.signIn();
    return;
  }

  try {
    await puter.auth.whoami();
  } catch (error) {
    if (!isUnknownSessionError(error)) {
      throw error;
    }

    try {
      await puter.auth.signOut();
    } catch {
      // Ignore sign-out failures and continue with a fresh sign-in.
    }

    await puter.auth.signIn();
  }
};

export const fetchAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
  const puter = (await import("@heyputer/puter.js")).default;
  await ensurePuterSession(puter);

    const dataUrl = sourceImage.startsWith('data:')
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.split(';')[0].split(':')[1];

    if(!mimeType || !base64Data) throw new Error('Invalid source image payload');

    let response;
    try {
      response = await puter.ai.txt2img(ARCHIFY_AI_RENDER_PROMPT, {
        provider: "gemini",
        model: "gemini-2.5-flash-image-preview",
        input_image: base64Data,
        input_image_mime_type: mimeType,
        ratio: { w: 1024, h: 1024 },
      });
    } catch (error) {
      if (!isUnknownSessionError(error)) {
        throw error;
      }

      await puter.auth.signOut();
      await puter.auth.signIn();
      response = await puter.ai.txt2img(ARCHIFY_AI_RENDER_PROMPT, {
        provider: "gemini",
        model: "gemini-2.5-flash-image-preview",
        input_image: base64Data,
        input_image_mime_type: mimeType,
        ratio: { w: 1024, h: 1024 },
      });
    }

    const rawImageUrl = (response as HTMLImageElement).src ?? null;

    if (!rawImageUrl) return { renderedImage: null, renderedPath: undefined };

    const renderedImage = rawImageUrl.startsWith('data:')
    ? rawImageUrl : await fetchAsDataUrl(rawImageUrl);

    return { renderedImage, renderedPath: undefined };
}
