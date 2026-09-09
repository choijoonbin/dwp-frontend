import { MeetingBackgroundError } from './meeting-background-types';
import type {
  MeetingBackgroundImage,
  MeetingProcessedBackgroundMode,
} from './meeting-background-types';

function drawCover(
  context: CanvasRenderingContext2D,
  image: MeetingBackgroundImage,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image.source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

/** A private scratch canvas is never published. Only a complete masked frame is copied out. */
export function createMeetingBackgroundCompositor(
  mode: MeetingProcessedBackgroundMode = 'blur',
  office?: MeetingBackgroundImage
) {
  if (mode === 'office' && !office) throw new MeetingBackgroundError('ASSET_UNAVAILABLE');
  const output = document.createElement('canvas');
  const composite = document.createElement('canvas');
  const foreground = document.createElement('canvas');
  const maskCanvas = document.createElement('canvas');
  const contexts = [output, composite, foreground, maskCanvas].map((canvas) =>
    canvas.getContext('2d')
  );
  if (contexts.some((context) => !context)) throw new MeetingBackgroundError('UNSUPPORTED');
  const [out, back, front, maskContext] = contexts as [
    CanvasRenderingContext2D,
    CanvasRenderingContext2D,
    CanvasRenderingContext2D,
    CanvasRenderingContext2D,
  ];
  output.width = 640;
  output.height = 360;
  out.fillStyle = 'black';
  out.fillRect(0, 0, output.width, output.height);
  const track = output.captureStream(20).getVideoTracks()[0];
  if (!track) throw new MeetingBackgroundError('UNSUPPORTED');
  return {
    track,
    render(
      video: HTMLVideoElement,
      mask: { width: number; height: number; foreground: Uint8Array }
    ) {
      if (
        !video.videoWidth ||
        !video.videoHeight ||
        mask.width <= 0 ||
        mask.height <= 0 ||
        mask.width * mask.height !== mask.foreground.length ||
        mask.foreground.some((pixel) => pixel !== 0 && pixel !== 1)
      ) {
        throw new MeetingBackgroundError('PROCESSING_FAILED');
      }
      const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      for (const canvas of [composite, foreground]) {
        canvas.width = width;
        canvas.height = height;
      }
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
      const pixels = maskContext.createImageData(mask.width, mask.height);
      mask.foreground.forEach((pixel, index) => {
        pixels.data[index * 4 + 3] = pixel === 1 ? 255 : 0;
      });
      maskContext.putImageData(pixels, 0, 0);
      // No raw background is ever drawn on the published canvas, including the first frame.
      back.fillStyle = 'black';
      back.fillRect(0, 0, width, height);
      if (mode === 'blur') {
        back.filter = 'blur(18px)';
        if (back.filter !== 'blur(18px)') throw new MeetingBackgroundError('UNSUPPORTED');
        back.drawImage(video, -20, -20, width + 40, height + 40);
        back.filter = 'none';
      } else {
        drawCover(back, office!, width, height);
      }
      front.drawImage(video, 0, 0, width, height);
      front.globalCompositeOperation = 'destination-in';
      front.drawImage(maskCanvas, 0, 0, width, height);
      front.globalCompositeOperation = 'source-over';
      back.drawImage(foreground, 0, 0);
      if (output.width !== width || output.height !== height) {
        output.width = width;
        output.height = height;
      }
      out.drawImage(composite, 0, 0);
    },
    destroy() {
      track.stop();
      out.fillStyle = 'black';
      out.fillRect(0, 0, output.width, output.height);
      for (const canvas of [output, composite, foreground, maskCanvas]) {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
  };
}
