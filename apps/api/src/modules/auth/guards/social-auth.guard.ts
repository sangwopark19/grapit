import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

@Injectable()
export class NaverAuthGuard extends AuthGuard('naver') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
