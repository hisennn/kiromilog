export type AvatarDimensions = {
  width: number;
  height: number;
};

function readUInt32BE(buffer: Buffer, offset: number) {
  if (offset < 0 || offset + 4 > buffer.length) {
    return null;
  }

  return buffer.readUInt32BE(offset);
}

function readUInt16BE(buffer: Buffer, offset: number) {
  if (offset < 0 || offset + 2 > buffer.length) {
    return null;
  }

  return buffer.readUInt16BE(offset);
}

function getPngDimensions(buffer: Buffer): AvatarDimensions | null {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }

  const width = readUInt32BE(buffer, 16);
  const height = readUInt32BE(buffer, 20);

  if (width === null || height === null || width < 1 || height < 1) {
    return null;
  }

  return { width, height };
}

function getJpegDimensions(buffer: Buffer): AvatarDimensions | null {
  let offset = 2;

  for (let segment = 0; segment < 64; segment += 1) {
    if (offset + 4 > buffer.length || buffer[offset] !== 0xff) {
      return null;
    }

    let markerOffset = offset + 1;

    while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
      markerOffset += 1;
    }

    if (markerOffset >= buffer.length) {
      return null;
    }

    const marker = buffer[markerOffset];

    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }

    const length = readUInt16BE(buffer, markerOffset + 1);

    if (length === null || length < 2) {
      return null;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      const height = readUInt16BE(buffer, markerOffset + 4);
      const width = readUInt16BE(buffer, markerOffset + 6);

      if (width === null || height === null || width < 1 || height < 1) {
        return null;
      }

      return { width, height };
    }

    offset = markerOffset + 1 + length;
  }

  return null;
}

function getWebpDimensions(buffer: Buffer): AvatarDimensions | null {
  if (buffer.length < 20) {
    return null;
  }

  const fourcc = buffer.toString("ascii", 12, 16);

  if (fourcc === "VP8 ") {
    if (
      buffer.length < 30 ||
      buffer[23] !== 0x9d ||
      buffer[24] !== 0x01 ||
      buffer[25] !== 0x2a
    ) {
      return null;
    }

    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;

    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (fourcc === "VP8L") {
    if (buffer.length < 25 || buffer[20] !== 0x2f) {
      return null;
    }

    const width = 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]);
    const height = 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6));

    return { width, height };
  }

  if (fourcc === "VP8X") {
    if (buffer.length < 30) {
      return null;
    }

    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  return null;
}

export function getAvatarDimensions(buffer: Buffer, mimeType: string): AvatarDimensions | null {
  if (mimeType === "image/png") {
    return getPngDimensions(buffer);
  }

  if (mimeType === "image/jpeg") {
    return getJpegDimensions(buffer);
  }

  if (mimeType === "image/webp") {
    return getWebpDimensions(buffer);
  }

  return null;
}
