import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  prepareReservationSchema,
  confirmPaymentSchema,
  cancelReservationSchema,
  type PrepareReservationInput,
  type ConfirmPaymentInput,
  type CancelReservationInput,
  type ReservationStatus,
} from '@grapit/shared';
import { ReservationService } from './reservation.service.js';

@Controller()
export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
  ) {}

  @Post('reservations/prepare')
  async prepareReservation(
    @Body(new ZodValidationPipe(prepareReservationSchema)) body: PrepareReservationInput,
    @Request() req: { user: { id: string } },
  ) {
    return this.reservationService.prepareReservation(body, req.user.id);
  }

  @Post('payments/confirm')
  async confirmPayment(
    @Body(new ZodValidationPipe(confirmPaymentSchema)) body: ConfirmPaymentInput,
    @Request() req: { user: { id: string } },
  ) {
    return this.reservationService.confirmAndCreateReservation(body, req.user.id);
  }

  @Get('users/me/reservations')
  async getMyReservations(
    @Request() req: { user: { id: string } },
    @Query('status') status?: string,
  ) {
    return this.reservationService.getMyReservations(
      req.user.id,
      status as ReservationStatus | undefined,
    );
  }

  @Get('reservations')
  async getReservationByOrderId(
    @Request() req: { user: { id: string } },
    @Query('orderId') orderId: string,
  ) {
    return this.reservationService.getReservationByOrderId(orderId, req.user.id);
  }

  @Get('reservations/:id')
  async getReservationDetail(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.reservationService.getReservationDetail(id, req.user.id);
  }

  @Put('reservations/:id/cancel')
  async cancelReservation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelReservationSchema)) body: CancelReservationInput,
    @Request() req: { user: { id: string } },
  ) {
    await this.reservationService.cancelReservation(id, req.user.id, body.reason);
    return { message: '예매가 취소되었습니다' };
  }
}
