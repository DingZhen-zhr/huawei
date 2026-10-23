// lib/zip.mjs —— 最小 zip 读取器（store / deflate），只依赖 node:zlib
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

export function readZip(file) {
  const buf = readFileSync(file);
  const eocd = findEOCD(buf);
  if (eocd < 0) throw new Error('不是有效的 zip：未找到中央目录结尾');
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(off) !== CEN) throw new Error('中央目录损坏（可能是不支持的分卷/Zip64）');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const cmtLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compSize, localOff, isDir: name.endsWith('/') });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return {
    entries,
    names: entries.map(e => e.name),
    read(e) {
      const lo = e.localOff;
      if (buf.readUInt32LE(lo) !== LOC) throw new Error('本地文件头损坏：' + e.name);
      const nLen = buf.readUInt16LE(lo + 26);
      const xLen = buf.readUInt16LE(lo + 28);
      const start = lo + 30 + nLen + xLen;
      const raw = buf.slice(start, start + e.compSize);
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRawSync(raw);
      throw new Error(`不支持的压缩方式 ${e.method}：${e.name}`);
    },
  };
}

function findEOCD(buf) {
  const min = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD) return i;
  }
  return -1;
}
