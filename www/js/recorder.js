// Canlı kayıt: 3D sahne + yazı katmanı → 1080×1920 MP4 (WebCodecs), olmazsa MediaRecorder
import { Muxer, ArrayBufferTarget } from '../lib/mp4-muxer.min.mjs';

export const REC_W = 1080, REC_H = 1920;

export class Recorder {
  constructor(sources) { this.sources = sources; this.active = false; this.comp = document.createElement('canvas'); this.comp.width = REC_W; this.comp.height = REC_H; this.cx = this.comp.getContext('2d'); }

  compose() {
    const { gl, overlay } = this.sources();
    const c = this.cx; c.drawImage(gl, 0, 0, REC_W, REC_H); c.drawImage(overlay, 0, 0, REC_W, REC_H);
  }

  async start({ fps = 30, mic = false, bitrate = 10e6 } = {}) {
    this.fps = fps; this.err = null; this.mode = null; this.micOk = false;
    let stream = null;
    if (mic) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); this.micOk = true; }
      catch (e) { this.micErr = 'Mikrofon açılamadı: ' + (e.message || e.name); }
    }
    this.stream = stream;
    if (window.VideoEncoder && window.VideoFrame) {
      let codec = null;
      for (const cd of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032', 'avc1.42003e']) {
        try { const s = await VideoEncoder.isConfigSupported({ codec: cd, width: REC_W, height: REC_H, bitrate, framerate: fps }); if (s.supported) { codec = cd; break; } } catch (e) { }
      }
      let audioCfg = null;
      if (stream && window.AudioEncoder && window.MediaStreamTrackProcessor) {
        const st = stream.getAudioTracks()[0].getSettings();
        const sr = st.sampleRate || 48000, ch = Math.min(2, st.channelCount || 1);
        for (const [cd, mc] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
          try { const s = await AudioEncoder.isConfigSupported({ codec: cd, sampleRate: sr, numberOfChannels: ch, bitrate: 128000 }); if (s.supported) { audioCfg = { cd, mc, sr, ch }; break; } } catch (e) { }
        }
      }
      if (codec && (!stream || audioCfg)) {
        this.target = new ArrayBufferTarget();
        this.muxer = new Muxer({ target: this.target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
          video: { codec: 'avc', width: REC_W, height: REC_H, frameRate: fps },
          audio: audioCfg ? { codec: audioCfg.mc, sampleRate: audioCfg.sr, numberOfChannels: audioCfg.ch } : undefined });
        this.enc = new VideoEncoder({ output: (c, m) => this.muxer.addVideoChunk(c, m), error: (e) => (this.err = e) });
        this.enc.configure({ codec, width: REC_W, height: REC_H, bitrate, framerate: fps, latencyMode: 'realtime' });
        if (audioCfg) {
          this.aenc = new AudioEncoder({ output: (c, m) => this.muxer.addAudioChunk(c, m), error: (e) => (this.err = e) });
          this.aenc.configure({ codec: audioCfg.cd, sampleRate: audioCfg.sr, numberOfChannels: audioCfg.ch, bitrate: 128000 });
          const proc = new MediaStreamTrackProcessor({ track: stream.getAudioTracks()[0] });
          this.areader = proc.readable.getReader();
          (async () => { try { while (true) { const { value, done } = await this.areader.read(); if (done) break; if (this.active && this.aenc.state === 'configured') this.aenc.encode(value); value.close(); } } catch (e) { } })();
        }
        this.mode = 'webcodecs';
      }
    }
    if (!this.mode) {
      if (!window.MediaRecorder || !this.comp.captureStream) throw new Error('Bu cihaz video kaydını desteklemiyor.');
      const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error('Bu cihaz video kaydını desteklemiyor.');
      const vs = this.comp.captureStream(fps); if (stream) stream.getAudioTracks().forEach((t) => vs.addTrack(t));
      this.parts = []; this.mime = mime;
      this.mr = new MediaRecorder(vs, { mimeType: mime, videoBitsPerSecond: bitrate });
      this.mr.ondataavailable = (e) => e.data.size && this.parts.push(e.data);
      this.mr.start(500); this.mode = 'mediarecorder';
    }
    this.t0 = performance.now(); this.next = 0; this.n = 0; this.active = true;
  }

  // Her ekran karesinden sonra çağrılır
  frame(now) {
    if (!this.active) return;
    const t = now - this.t0;
    if (this.mode === 'mediarecorder') { this.compose(); return; }
    if (t + 2 < this.next) return;
    if (t - this.next > 3000 / this.fps) this.next = t; // çok geride kaldıysak atla
    this.compose();
    if (this.err) return;
    if (this.enc.encodeQueueSize > 8) { this.next += 1000 / this.fps; return; } // cihaz yetişemiyor: kare atla
    const vf = new VideoFrame(this.comp, { timestamp: Math.round(this.next * 1000), duration: Math.round(1e6 / this.fps) });
    this.enc.encode(vf, { keyFrame: this.n % (this.fps * 2) === 0 }); vf.close();
    this.n++; this.next += 1000 / this.fps;
  }
  elapsed() { return this.active ? (performance.now() - this.t0) / 1000 : 0; }

  async stop() {
    if (!this.active) return null; this.active = false;
    const dur = (performance.now() - this.t0) / 1000;
    try {
      if (this.mode === 'webcodecs') {
        await this.enc.flush(); this.enc.close();
        if (this.aenc) { try { this.areader.cancel(); } catch (e) { } await this.aenc.flush(); this.aenc.close(); }
        if (this.err) throw this.err;
        this.muxer.finalize();
        return { blob: new Blob([this.target.buffer], { type: 'video/mp4' }), ext: 'mp4', dur };
      }
      const done = new Promise((r) => (this.mr.onstop = r)); this.mr.stop(); await done;
      const type = this.mime.split(';')[0];
      return { blob: new Blob(this.parts, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm', dur };
    } finally { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; this.aenc = null; }
  }
}

// ---------- dosya kaydetme / paylaşma ----------
function cap() { return window.Capacitor?.Plugins || null; }
export const isApp = () => !!window.Capacitor?.isNativePlatform?.();

async function blobToB64Chunks(blob, size = 3 * 1024 * 1024) {
  const out = [];
  for (let o = 0; o < blob.size; o += size) {
    const part = blob.slice(o, o + size);
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(part); });
    out.push(b64);
  }
  return out;
}

// Telefonun Belgeler/LatteTaktik klasörüne kaydeder. Dönen: {uri, where}
export async function saveFile(blob, name, sub = '') {
  const P = cap();
  if (isApp() && P?.Filesystem) {
    const path = `LatteTaktik/${sub ? sub + '/' : ''}${name}`;
    const chunks = await blobToB64Chunks(blob);
    await P.Filesystem.writeFile({ path, data: chunks[0] || '', directory: 'DOCUMENTS', recursive: true });
    for (let i = 1; i < chunks.length; i++) await P.Filesystem.appendFile({ path, data: chunks[i], directory: 'DOCUMENTS' });
    const { uri } = await P.Filesystem.getUri({ path, directory: 'DOCUMENTS' });
    return { uri, where: `Belgeler/${path}` };
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return { uri: null, where: 'İndirilenler' };
}
export async function shareFile(uri, title) {
  const P = cap(); if (!P?.Share || !uri) return false;
  await P.Share.share({ title, files: [uri], dialogTitle: 'Videoyu gönder' }); return true;
}
