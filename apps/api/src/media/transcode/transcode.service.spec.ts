import { describe, expect, it } from 'vitest';

import { TranscodeService } from './transcode.service';

describe('TranscodeService', () => {
  const service = new TranscodeService({} as never, {} as never);

  it('gera pipeline HLS com áudio quando o arquivo possui trilha de áudio', () => {
    const args = service.buildFfmpegArgs({
      inputPath: '/tmp/input.mov',
      outputDir: '/tmp/output',
      fps: 30,
      hasAudio: true,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });

    expect(args).toContain('0:a:0?');
    expect(args).toContain('-c:a:0');
    expect(args).toContain('-c:a:4');

    const varStreamMapIndex = args.indexOf('-var_stream_map');
    const filterComplexIndex = args.indexOf('-filter_complex');
    expect(varStreamMapIndex).toBeGreaterThan(-1);
    expect(filterComplexIndex).toBeGreaterThan(-1);
    expect(args[varStreamMapIndex + 1]).toContain('a:0');
    expect(args[varStreamMapIndex + 1]).toContain('a:4');
    expect(args[filterComplexIndex + 1]).toContain('[v0]scale=w=426:h=238[v0out]');
    expect(args).toContain('-hide_banner');
    expect(args).toContain('-loglevel');
  });

  it('gera pipeline HLS sem áudio quando o arquivo não possui trilha de áudio', () => {
    const args = service.buildFfmpegArgs({
      inputPath: '/tmp/input.mov',
      outputDir: '/tmp/output',
      fps: 30,
      hasAudio: false,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });

    expect(args).not.toContain('0:a:0?');
    expect(args).not.toContain('-c:a');
    expect(args).not.toContain('-b:a');
    expect(args).not.toContain('-ar');

    const varStreamMapIndex = args.indexOf('-var_stream_map');
    expect(varStreamMapIndex).toBeGreaterThan(-1);
    expect(args[varStreamMapIndex + 1]).not.toContain('a:0');
    expect(args[varStreamMapIndex + 1]).toContain('v:0');
  });

  it('gera escala orientada pela altura para vídeos em retrato', () => {
    const args = service.buildFfmpegArgs({
      inputPath: '/tmp/input.mov',
      outputDir: '/tmp/output',
      fps: 30,
      hasAudio: true,
      sourceWidth: 1080,
      sourceHeight: 1920,
    });
    const filterComplexIndex = args.indexOf('-filter_complex');

    expect(filterComplexIndex).toBeGreaterThan(-1);
    expect(args[filterComplexIndex + 1]).toContain('[v0]scale=w=238:h=426[v0out]');
    expect(args[filterComplexIndex + 1]).toContain('[v4]scale=w=1080:h=1920[v4out]');
  });
});