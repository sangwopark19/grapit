import { Controller, Get, Put, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { UploadService } from './upload.service.js';

/**
 * Public controller for local file upload/serving (dev mode only).
 * Separated from AdminPerformanceController so that presigned-URL-style
 * PUT uploads and <img src="..."> GET requests work without JWT guards.
 */
@Controller('admin')
@Public()
export class LocalUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Put('upload/local/:folder/:filename')
  async uploadLocal(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    const key = `${folder}/${filename}`;
    const buffers: Uint8Array[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const buffer = Buffer.concat(buffers);
    await this.uploadService.saveLocalFile(key, buffer);
    return { success: true };
  }

  @Get('upload/local/:folder/:filename')
  async serveLocal(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `${folder}/${filename}`;
    const file = await this.uploadService.getLocalFile(key);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Override Helmet's same-origin CORP to allow cross-origin image loading
    // (frontend on :3000 loads images from API on :8080)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(file.buffer);
  }
}
