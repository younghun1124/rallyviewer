/**
 * MP4 컨테이너 헤더를 파싱하여 코덱, 프로필, 프레임레이트 등 상세 메타데이터를 추출합니다.
 * Range 요청으로 파일 앞부분만 읽어서 파싱합니다.
 */

export interface Mp4TrackInfo {
  type: 'video' | 'audio' | 'subtitle' | 'unknown';
  codec: string;
  codecLong: string;
  // video
  width?: number;
  height?: number;
  frameRate?: number;
  bitDepth?: number;
  profile?: string;
  level?: string;
  chromaSubsampling?: string;
  // audio
  sampleRate?: number;
  channelCount?: number;
  audioBitDepth?: number;
  // common
  language?: string;
  durationMs?: number;
  timescale?: number;
}

export interface Mp4Metadata {
  majorBrand: string;
  minorVersion: number;
  compatibleBrands: string[];
  creationTime?: Date;
  modificationTime?: Date;
  durationMs?: number;
  timescale?: number;
  tracks: Mp4TrackInfo[];
  // HTTP metadata
  contentType?: string;
  lastModified?: string;
  etag?: string;
  server?: string;
  acceptRanges?: string;
}

class BufferReader {
  private view: DataView;
  private pos: number;

  constructor(buffer: ArrayBuffer, offset = 0) {
    this.view = new DataView(buffer);
    this.pos = offset;
  }

  get position() { return this.pos; }
  get length() { return this.view.byteLength; }
  get remaining() { return this.view.byteLength - this.pos; }

  seek(pos: number) { this.pos = pos; }
  skip(n: number) { this.pos += n; }

  u8() { const v = this.view.getUint8(this.pos); this.pos += 1; return v; }
  u16() { const v = this.view.getUint16(this.pos); this.pos += 2; return v; }
  u32() { const v = this.view.getUint32(this.pos); this.pos += 4; return v; }
  u64() {
    const hi = this.view.getUint32(this.pos);
    const lo = this.view.getUint32(this.pos + 4);
    this.pos += 8;
    return hi * 0x100000000 + lo;
  }

  i16() { const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos); this.pos += 4; return v; }

  str(n: number) {
    let s = '';
    for (let i = 0; i < n; i++) {
      s += String.fromCharCode(this.view.getUint8(this.pos + i));
    }
    this.pos += n;
    return s;
  }

  // fixed-point 16.16
  fixed32() {
    const v = this.i32();
    return v / 65536;
  }

  // fixed-point 8.8
  fixed16() {
    const v = this.i16();
    return v / 256;
  }

  slice(start: number, end: number): BufferReader {
    return new BufferReader((this.view.buffer as ArrayBuffer).slice(start, end));
  }
}

interface Box {
  type: string;
  start: number;
  size: number;
  dataStart: number;
}

function readBoxHeader(r: BufferReader): Box | null {
  if (r.remaining < 8) return null;
  const start = r.position;
  let size = r.u32();
  const type = r.str(4);
  let dataStart = r.position;

  if (size === 1) {
    if (r.remaining < 8) return null;
    size = Number(r.u64());
    dataStart = r.position;
  } else if (size === 0) {
    size = r.length - start;
  }

  return { type, start, size, dataStart };
}

function findBoxes(r: BufferReader, end: number): Box[] {
  const boxes: Box[] = [];
  while (r.position < end && r.remaining >= 8) {
    const box = readBoxHeader(r);
    if (!box || box.size < 8) break;
    boxes.push(box);
    const nextPos = box.start + box.size;
    if (nextPos > end || nextPos <= r.position) break;
    r.seek(nextPos);
  }
  return boxes;
}

const CODEC_NAMES: Record<string, string> = {
  'avc1': 'H.264/AVC', 'avc3': 'H.264/AVC',
  'hev1': 'H.265/HEVC', 'hvc1': 'H.265/HEVC',
  'vp08': 'VP8', 'vp09': 'VP9',
  'av01': 'AV1',
  'mp4v': 'MPEG-4 Part 2',
  'mp4a': 'AAC',
  'ac-3': 'AC-3 (Dolby Digital)',
  'ec-3': 'E-AC-3 (Dolby Digital Plus)',
  'Opus': 'Opus',
  'fLaC': 'FLAC',
  'dtsl': 'DTS',
  'dtsh': 'DTS-HD',
  'tx3g': 'MPEG-4 Timed Text',
  'wvtt': 'WebVTT',
};

const H264_PROFILES: Record<number, string> = {
  66: 'Baseline', 77: 'Main', 88: 'Extended',
  100: 'High', 110: 'High 10', 122: 'High 4:2:2',
  244: 'High 4:4:4 Predictive',
};

const H265_PROFILES: Record<number, string> = {
  1: 'Main', 2: 'Main 10', 3: 'Main Still Picture',
  4: 'Range Extensions',
};

function macTimeToDate(macTime: number): Date | undefined {
  if (macTime === 0) return undefined;
  // Mac epoch: 1904-01-01, Unix epoch: 1970-01-01
  const unixTime = macTime - 2082844800;
  if (unixTime < 0 || unixTime > 4102444800) return undefined;
  return new Date(unixTime * 1000);
}

function parseLanguage(lang: number): string {
  // ISO 639-2/T packed: 5 bits per char, 3 chars
  const c1 = ((lang >> 10) & 0x1f) + 0x60;
  const c2 = ((lang >> 5) & 0x1f) + 0x60;
  const c3 = (lang & 0x1f) + 0x60;
  const str = String.fromCharCode(c1, c2, c3);
  if (str === 'und') return 'und';
  return str;
}

function parseMvhd(r: BufferReader, box: Box): { timescale: number; durationMs: number; creationTime?: Date; modificationTime?: Date } {
  r.seek(box.dataStart);
  const version = r.u8();
  r.skip(3); // flags

  let creationTime: number, modificationTime: number, timescale: number, duration: number;
  if (version === 1) {
    creationTime = Number(r.u64());
    modificationTime = Number(r.u64());
    timescale = r.u32();
    duration = Number(r.u64());
  } else {
    creationTime = r.u32();
    modificationTime = r.u32();
    timescale = r.u32();
    duration = r.u32();
  }

  const durationMs = timescale > 0 ? (duration / timescale) * 1000 : 0;
  return {
    timescale,
    durationMs,
    creationTime: macTimeToDate(creationTime),
    modificationTime: macTimeToDate(modificationTime),
  };
}

function parseTkhd(r: BufferReader, box: Box): { trackWidth: number; trackHeight: number } {
  r.seek(box.dataStart);
  const version = r.u8();
  r.skip(3); // flags
  if (version === 1) { r.skip(8 + 8 + 4 + 4 + 8); } // creation, modification, track_id, reserved, duration
  else { r.skip(4 + 4 + 4 + 4 + 4); }
  r.skip(8); // reserved
  r.skip(2); // layer
  r.skip(2); // alternate_group
  r.skip(2); // volume
  r.skip(2); // reserved
  r.skip(36); // matrix
  const trackWidth = r.fixed32();
  const trackHeight = r.fixed32();
  return { trackWidth: Math.round(trackWidth), trackHeight: Math.round(trackHeight) };
}

function parseMdhd(r: BufferReader, box: Box): { timescale: number; durationMs: number; language: string } {
  r.seek(box.dataStart);
  const version = r.u8();
  r.skip(3);
  let timescale: number, duration: number;
  if (version === 1) {
    r.skip(8 + 8); // creation, modification
    timescale = r.u32();
    duration = Number(r.u64());
  } else {
    r.skip(4 + 4);
    timescale = r.u32();
    duration = r.u32();
  }
  const langCode = r.u16();
  const language = parseLanguage(langCode);
  const durationMs = timescale > 0 ? (duration / timescale) * 1000 : 0;
  return { timescale, durationMs, language };
}

function parseHdlr(r: BufferReader, box: Box): string {
  r.seek(box.dataStart);
  r.skip(4); // version + flags
  r.skip(4); // pre_defined
  return r.str(4); // handler_type: 'vide', 'soun', 'subt', etc.
}

function parseStsd(r: BufferReader, box: Box, handlerType: string, timescale: number): Partial<Mp4TrackInfo> {
  r.seek(box.dataStart);
  r.skip(4); // version + flags
  const entryCount = r.u32();
  if (entryCount === 0 || r.remaining < 8) return {};

  const entryBox = readBoxHeader(r);
  if (!entryBox) return {};

  const codec = entryBox.type.trim();
  const codecLong = CODEC_NAMES[codec] || codec;
  const info: Partial<Mp4TrackInfo> = { codec, codecLong };

  if (handlerType === 'vide') {
    info.type = 'video';
    r.seek(entryBox.dataStart);
    r.skip(6); // reserved
    r.skip(2); // data_reference_index
    r.skip(2); // pre_defined
    r.skip(2); // reserved
    r.skip(12); // pre_defined
    info.width = r.u16();
    info.height = r.u16();
    r.skip(4); // horizresolution
    r.skip(4); // vertresolution
    r.skip(4); // reserved
    r.skip(2); // frame_count
    r.skip(32); // compressorname
    r.skip(2); // depth (항상 0x0018, 실제 비트심도 아님)
    r.skip(2); // pre_defined

    // Parse sub-boxes for codec config
    const subEnd = entryBox.start + entryBox.size;
    if (r.position < subEnd) {
      const subBoxes = findBoxes(r, subEnd);
      for (const sub of subBoxes) {
        if (sub.type === 'avcC' && sub.size >= 12) {
          r.seek(sub.dataStart);
          r.skip(1); // configurationVersion
          const profileIdc = r.u8();
          r.skip(1); // profile_compatibility
          const levelIdc = r.u8();
          info.profile = H264_PROFILES[profileIdc] || `Profile ${profileIdc}`;
          info.level = `${(levelIdc / 10).toFixed(1)}`;
          info.codecLong = `H.264 ${info.profile}@L${info.level}`;
          // 프로필로 비트 심도 판단
          if (profileIdc === 110) info.bitDepth = 10; // High 10
          else if (profileIdc === 122 || profileIdc === 244) info.bitDepth = 10; // High 4:2:2, High 4:4:4
          else info.bitDepth = 8;
        } else if (sub.type === 'hvcC' && sub.size >= 12) {
          r.seek(sub.dataStart);
          r.skip(1); // configurationVersion
          const byte1 = r.u8();
          const profileIdc = byte1 & 0x1f;
          r.skip(4); // profile_compatibility
          r.skip(6); // constraint_indicator
          const levelIdc = r.u8();
          info.profile = H265_PROFILES[profileIdc] || `Profile ${profileIdc}`;
          info.level = `${(levelIdc / 30).toFixed(1)}`;
          info.codecLong = `H.265 ${info.profile}@L${info.level}`;
          // 프로필로 비트 심도 판단
          if (profileIdc === 2) info.bitDepth = 10; // Main 10
          else if (profileIdc === 1) info.bitDepth = 8; // Main
          else if (profileIdc === 4) info.bitDepth = 10; // Range Extensions (보통 10bit)
        } else if (sub.type === 'colr' && sub.size >= 18) {
          // Color info
          r.seek(sub.dataStart);
          const colorType = r.str(4);
          if (colorType === 'nclx' || colorType === 'nclc') {
            // could parse primaries, transfer, matrix
          }
        }
      }
    }
  } else if (handlerType === 'soun') {
    info.type = 'audio';
    r.seek(entryBox.dataStart);
    r.skip(6); // reserved
    r.skip(2); // data_reference_index
    const stsdVersion = r.u16();
    r.skip(2); // revision
    r.skip(4); // vendor
    info.channelCount = r.u16();
    info.audioBitDepth = r.u16();
    r.skip(2); // compression_id
    r.skip(2); // packet_size
    info.sampleRate = r.u16(); // only integer part from fixed16.16
    r.skip(2); // fraction part

    if (stsdVersion === 1) {
      r.skip(16); // v1 extra fields
    } else if (stsdVersion === 2) {
      r.skip(36); // v2 extra fields
      // v2 has proper sample rate as float64
    }

    // Parse sub-boxes for detailed codec info
    const subEnd = entryBox.start + entryBox.size;
    if (r.position < subEnd) {
      const subBoxes = findBoxes(r, subEnd);
      for (const sub of subBoxes) {
        if (sub.type === 'esds' && sub.size > 12) {
          r.seek(sub.dataStart);
          r.skip(4); // version + flags
          // parse ES descriptor to find audioObjectType
          // simplified: just scan for the DecoderConfigDescriptor
          const esdsEnd = sub.start + sub.size;
          while (r.position < esdsEnd - 2) {
            const tag = r.u8();
            // descriptor length (variable)
            let len = 0;
            for (let i = 0; i < 4; i++) {
              const b = r.u8();
              len = (len << 7) | (b & 0x7f);
              if (!(b & 0x80)) break;
            }
            if (tag === 4 && r.remaining >= 13) { // DecoderConfigDescriptor
              const objectTypeIndication = r.u8();
              if (objectTypeIndication === 0x40) info.codecLong = 'AAC';
              else if (objectTypeIndication === 0x67) info.codecLong = 'AAC (Main)';
              else if (objectTypeIndication === 0x68) info.codecLong = 'AAC-LC';
              else if (objectTypeIndication === 0x69) info.codecLong = 'MP3';
              break;
            }
          }
        } else if (sub.type === 'dac3' || sub.type === 'dec3') {
          // AC-3/E-AC-3 specific config
        }
      }
    }
  } else if (handlerType === 'subt' || handlerType === 'text' || handlerType === 'sbtl') {
    info.type = 'subtitle';
  } else {
    info.type = 'unknown';
  }

  return info;
}

function parseStts(r: BufferReader, box: Box): { sampleCount: number; sampleDelta: number }[] {
  r.seek(box.dataStart);
  r.skip(4); // version + flags
  const entryCount = r.u32();
  const entries: { sampleCount: number; sampleDelta: number }[] = [];
  const maxEntries = Math.min(entryCount, 100);
  for (let i = 0; i < maxEntries && r.remaining >= 8; i++) {
    entries.push({ sampleCount: r.u32(), sampleDelta: r.u32() });
  }
  return entries;
}

function parseTrak(r: BufferReader, box: Box): Mp4TrackInfo | null {
  r.seek(box.dataStart);
  const trakBoxes = findBoxes(r, box.start + box.size);

  let trackWidth = 0, trackHeight = 0;
  let timescale = 0, language = 'und', durationMs = 0;
  let handlerType = '';
  const info: Partial<Mp4TrackInfo> = {};

  // tkhd
  const tkhd = trakBoxes.find(b => b.type === 'tkhd');
  if (tkhd) {
    const tk = parseTkhd(r, tkhd);
    trackWidth = tk.trackWidth;
    trackHeight = tk.trackHeight;
  }

  // mdia
  const mdia = trakBoxes.find(b => b.type === 'mdia');
  if (!mdia) return null;

  r.seek(mdia.dataStart);
  const mdiaBoxes = findBoxes(r, mdia.start + mdia.size);

  // mdhd
  const mdhd = mdiaBoxes.find(b => b.type === 'mdhd');
  if (mdhd) {
    const md = parseMdhd(r, mdhd);
    timescale = md.timescale;
    durationMs = md.durationMs;
    language = md.language;
  }

  // hdlr
  const hdlr = mdiaBoxes.find(b => b.type === 'hdlr');
  if (hdlr) {
    handlerType = parseHdlr(r, hdlr);
  }

  // minf > stbl > stsd
  const minf = mdiaBoxes.find(b => b.type === 'minf');
  if (minf) {
    r.seek(minf.dataStart);
    const minfBoxes = findBoxes(r, minf.start + minf.size);
    const stbl = minfBoxes.find(b => b.type === 'stbl');
    if (stbl) {
      r.seek(stbl.dataStart);
      const stblBoxes = findBoxes(r, stbl.start + stbl.size);

      const stsd = stblBoxes.find(b => b.type === 'stsd');
      if (stsd) {
        Object.assign(info, parseStsd(r, stsd, handlerType, timescale));
      }

      // stts for frame rate
      if (handlerType === 'vide') {
        const stts = stblBoxes.find(b => b.type === 'stts');
        if (stts && timescale > 0) {
          const entries = parseStts(r, stts);
          if (entries.length > 0 && entries[0].sampleDelta > 0) {
            info.frameRate = Math.round((timescale / entries[0].sampleDelta) * 100) / 100;
          }
        }
      }
    }
  }

  // Use tkhd dimensions if stsd didn't provide
  if (info.type === 'video' && !info.width && trackWidth > 0) {
    info.width = trackWidth;
    info.height = trackHeight;
  }

  info.language = language;
  info.durationMs = durationMs;
  info.timescale = timescale;

  if (!info.type) {
    if (handlerType === 'vide') info.type = 'video';
    else if (handlerType === 'soun') info.type = 'audio';
    else if (handlerType === 'subt' || handlerType === 'text') info.type = 'subtitle';
    else info.type = 'unknown';
  }

  if (!info.codec) info.codec = 'unknown';
  if (!info.codecLong) info.codecLong = info.codec;

  return info as Mp4TrackInfo;
}

function parseMoov(r: BufferReader, moovBox: Box): Partial<Mp4Metadata> {
  r.seek(moovBox.dataStart);
  const children = findBoxes(r, moovBox.start + moovBox.size);
  const result: Partial<Mp4Metadata> = { tracks: [] };

  // mvhd
  const mvhd = children.find(b => b.type === 'mvhd');
  if (mvhd) {
    const mv = parseMvhd(r, mvhd);
    result.timescale = mv.timescale;
    result.durationMs = mv.durationMs;
    result.creationTime = mv.creationTime;
    result.modificationTime = mv.modificationTime;
  }

  // traks
  const traks = children.filter(b => b.type === 'trak');
  for (const trak of traks) {
    const track = parseTrak(r, trak);
    if (track) result.tracks!.push(track);
  }

  return result;
}

function parseFtyp(r: BufferReader, box: Box): { majorBrand: string; minorVersion: number; compatibleBrands: string[] } {
  r.seek(box.dataStart);
  const majorBrand = r.str(4).trim();
  const minorVersion = r.u32();
  const compatibleBrands: string[] = [];
  const remaining = (box.start + box.size) - r.position;
  const brandCount = Math.floor(remaining / 4);
  for (let i = 0; i < brandCount && r.remaining >= 4; i++) {
    const brand = r.str(4).trim();
    if (brand) compatibleBrands.push(brand);
  }
  return { majorBrand, minorVersion, compatibleBrands };
}

const BRAND_NAMES: Record<string, string> = {
  'isom': 'ISO Base Media',
  'iso2': 'ISO Base Media v2',
  'iso5': 'ISO Base Media v5',
  'iso6': 'ISO Base Media v6',
  'mp41': 'MP4 v1',
  'mp42': 'MP4 v2',
  'M4V ': 'M4V (iTunes)',
  'M4A ': 'M4A (iTunes Audio)',
  'qt  ': 'QuickTime',
  'avc1': 'AVC/H.264',
  'dash': 'DASH',
  'msdh': 'DASH (MS)',
  'msix': 'DASH (MS Indexed)',
};

export function getBrandName(brand: string): string {
  return BRAND_NAMES[brand] || brand;
}

/**
 * 앞부분 헤더에서 top-level 박스 위치를 스캔합니다.
 * mdat 같은 거대 박스는 크기만 읽고 건너뛰어 moov 위치를 파악합니다.
 * 반환값은 각 박스의 파일 내 절대 오프셋과 크기입니다.
 */
function scanTopLevelBoxes(r: BufferReader, bufferSize: number, totalFileSize: number): { type: string; fileOffset: number; size: number }[] {
  const boxes: { type: string; fileOffset: number; size: number }[] = [];
  r.seek(0);

  while (r.remaining >= 8) {
    const pos = r.position;
    let size = r.u32();
    const type = r.str(4);
    let headerSize = 8;

    if (size === 1) {
      if (r.remaining < 8) break;
      size = Number(r.u64());
      headerSize = 16;
    } else if (size === 0) {
      size = totalFileSize - pos;
    }

    boxes.push({ type, fileOffset: pos, size });

    // 다음 박스로 이동 (버퍼 내에 있으면)
    const nextPos = pos + size;
    if (nextPos > bufferSize || nextPos <= r.position) {
      // 이 박스는 버퍼를 넘어감 — 남은 박스들은 파일 뒤쪽에 있음
      // 파일 크기를 알면 나머지 공간에 박스가 더 있을 수 있음을 기록
      break;
    }
    r.seek(nextPos);
  }

  return boxes;
}

export async function parseMp4Metadata(url: string): Promise<Mp4Metadata | null> {
  try {
    // 1. HEAD 요청으로 HTTP 메타데이터 + 파일 크기 확인
    const headRes = await fetch(url, { method: 'HEAD' });
    const contentType = headRes.headers.get('content-type') || undefined;
    const lastModified = headRes.headers.get('last-modified') || undefined;
    const etag = headRes.headers.get('etag') || undefined;
    const server = headRes.headers.get('server') || undefined;
    const acceptRanges = headRes.headers.get('accept-ranges') || undefined;
    const contentLength = headRes.headers.get('content-length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

    const httpMeta = { contentType, lastModified, etag, server, acceptRanges };
    const rangeSupported = acceptRanges === 'bytes' || totalSize > 0;

    let result: Mp4Metadata = {
      majorBrand: '',
      minorVersion: 0,
      compatibleBrands: [],
      tracks: [],
      ...httpMeta,
    };

    // 2. 앞부분 가져오기 (64KB면 ftyp + top-level 헤더 파악에 충분)
    const HEAD_CHUNK = 64 * 1024;
    let headBuffer: ArrayBuffer;
    if (rangeSupported) {
      const res = await fetch(url, {
        headers: { 'Range': `bytes=0-${HEAD_CHUNK - 1}` }
      });
      headBuffer = await res.arrayBuffer();
    } else {
      if (totalSize > 10 * 1024 * 1024) return result;
      const res = await fetch(url);
      headBuffer = await res.arrayBuffer();
    }

    const headR = new BufferReader(headBuffer);

    // 3. Top-level 박스 스캔 (ftyp, mdat, moov 등의 위치 파악)
    const topBoxes = scanTopLevelBoxes(headR, headBuffer.byteLength, totalSize || headBuffer.byteLength);

    // ftyp 파싱
    const ftypInfo = topBoxes.find(b => b.type === 'ftyp');
    if (ftypInfo && ftypInfo.fileOffset + ftypInfo.size <= headBuffer.byteLength) {
      headR.seek(ftypInfo.fileOffset + 8); // skip size + type
      const ft = parseFtyp(headR, {
        type: 'ftyp',
        start: ftypInfo.fileOffset,
        size: ftypInfo.size,
        dataStart: ftypInfo.fileOffset + 8,
      });
      result.majorBrand = ft.majorBrand;
      result.minorVersion = ft.minorVersion;
      result.compatibleBrands = ft.compatibleBrands;
    }

    // 4. moov 찾기 및 파싱
    const moovInfo = topBoxes.find(b => b.type === 'moov');

    if (moovInfo && moovInfo.fileOffset + moovInfo.size <= headBuffer.byteLength) {
      // moov이 앞부분 버퍼 안에 완전히 들어있음 (faststart)
      const moovData = parseMoov(headR, {
        type: 'moov',
        start: moovInfo.fileOffset,
        size: moovInfo.size,
        dataStart: moovInfo.fileOffset + 8,
      });
      Object.assign(result, moovData);
    } else if (moovInfo && rangeSupported) {
      // moov 위치는 알지만 버퍼에 다 안 들어옴 — 정확한 범위 요청
      const moovEnd = moovInfo.fileOffset + moovInfo.size;
      const res = await fetch(url, {
        headers: { 'Range': `bytes=${moovInfo.fileOffset}-${moovEnd - 1}` }
      });
      const moovBuffer = await res.arrayBuffer();
      const moovR = new BufferReader(moovBuffer);
      const moovData = parseMoov(moovR, {
        type: 'moov',
        start: 0,
        size: moovBuffer.byteLength,
        dataStart: 8,
      });
      Object.assign(result, moovData);
    } else if (!moovInfo && rangeSupported && totalSize > 0) {
      // moov이 앞 64KB에 헤더조차 없음 — 파일 끝에 있을 수 있음
      // 앞부분에서 알려진 박스들의 끝 위치로 moov 시작 추정
      let knownEnd = 0;
      for (const b of topBoxes) {
        const bEnd = b.fileOffset + b.size;
        if (bEnd > knownEnd) knownEnd = bEnd;
      }

      if (knownEnd < totalSize) {
        // knownEnd 위치에 moov 헤더가 있을 수 있음 — 먼저 헤더만 읽기
        const probeRes = await fetch(url, {
          headers: { 'Range': `bytes=${knownEnd}-${knownEnd + 15}` }
        });
        const probeBuffer = await probeRes.arrayBuffer();
        if (probeBuffer.byteLength >= 8) {
          const probeR = new BufferReader(probeBuffer);
          let moovSize = probeR.u32();
          const moovType = probeR.str(4);
          if (moovSize === 1 && probeBuffer.byteLength >= 16) {
            moovSize = Number(probeR.u64());
          }

          if (moovType === 'moov' && moovSize > 0) {
            const moovEnd = knownEnd + moovSize;
            const res = await fetch(url, {
              headers: { 'Range': `bytes=${knownEnd}-${moovEnd - 1}` }
            });
            const moovBuffer = await res.arrayBuffer();
            const moovR = new BufferReader(moovBuffer);
            const headerSize = moovSize > 0xFFFFFFFF ? 16 : 8;
            const moovData = parseMoov(moovR, {
              type: 'moov',
              start: 0,
              size: moovBuffer.byteLength,
              dataStart: headerSize,
            });
            Object.assign(result, moovData);
          }
        }
      }
    }

    return result;
  } catch (e) {
    console.warn('MP4 metadata parsing failed:', e);
    return null;
  }
}
