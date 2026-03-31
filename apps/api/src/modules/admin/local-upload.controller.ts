import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { UploadService } from './upload.service.js';

/**
 * Public controller for serving locally uploaded files (dev mode only).
 * Separated from AdminPerformanceController so that <img src="..."> can
 * access files without JWT / admin role guards.
 */
@Controller('admin')
@Public()
export class LocalUploadController {
  constructor(private readonly uploadService: UploadService) {}

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
    res.send(file.buffer);
  }
}
