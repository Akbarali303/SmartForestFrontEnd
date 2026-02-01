import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return { status: 'ok', api: '/api/v1/events', map: '/map/' };
  }
}
