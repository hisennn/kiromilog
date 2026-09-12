import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getAvatarDimensions } from "@/lib/avatar-image";

function pngBuffer(width: number, height: number) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 2;
  return buffer;
}

function jpegBuffer(width: number, height: number) {
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(11);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0]);
}

function webpVp8xBuffer(width: number, height: number) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe("getAvatarDimensions", () => {
  it("reads PNG dimensions from IHDR", () => {
    assert.deepEqual(getAvatarDimensions(pngBuffer(800, 600), "image/png"), {
      width: 800,
      height: 600,
    });
  });

  it("reads JPEG dimensions from SOF0", () => {
    assert.deepEqual(getAvatarDimensions(jpegBuffer(640, 480), "image/jpeg"), {
      width: 640,
      height: 480,
    });
  });

  it("reads WebP dimensions from VP8X", () => {
    assert.deepEqual(getAvatarDimensions(webpVp8xBuffer(320, 240), "image/webp"), {
      width: 320,
      height: 240,
    });
  });

  it("rejects truncated and unknown input", () => {
    assert.equal(getAvatarDimensions(Buffer.alloc(0), "image/png"), null);
    assert.equal(getAvatarDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), "image/jpeg"), null);
    assert.equal(getAvatarDimensions(pngBuffer(10, 10), "image/gif"), null);
  });
});
