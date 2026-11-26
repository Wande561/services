import { BadRequestException } from '@nestjs/common';

export function imageData(value: unknown) {
  if (typeof value !== 'string' || value.length > 1400000) throw new BadRequestException('Choose a photo of at most 1 MB');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new BadRequestException('Choose a JPEG, PNG, or WebP photo');
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > 1048576 || image.toString('base64') !== match[2]) throw new BadRequestException('Invalid photo');
  const jpeg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const png = image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  if ((match[1] === 'image/jpeg' && !jpeg) || (match[1] === 'image/png' && !png) || (match[1] === 'image/webp' && !webp)) throw new BadRequestException('Photo content does not match its type');
  return { mimeType: match[1], image };
}
